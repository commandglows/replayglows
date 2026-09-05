"""Offline dependency regressions: run in the worker image with --network none."""

import contextlib
import os
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import wave

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"

import httpx

import server


class WorkerContractTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.stack = contextlib.ExitStack()
        self.addCleanup(self.stack.close)
        self.stack.enter_context(patch.object(server, "WORKER_SECRET", "test-only"))
        self.stack.enter_context(patch.object(server, "YTDLP_COOKIES_FILE", ""))
        self.stack.enter_context(patch.object(server, "JOB_QUEUE_TIMEOUT_SECONDS", 0))
        self.stack.enter_context(patch.object(server.requests, "post", side_effect=AssertionError("Unexpected network call")))
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=server.app), base_url="http://worker.test"
        )
        self.addAsyncCleanup(self.client.aclose)
        self.body = {"provider": "faster_whisper", "youtubeVideoId": "fixture", "language": "en"}
        self.headers = {"Authorization": "Bearer test-only"}

    async def post(self, **changes):
        return await self.client.post("/transcribe", json={**self.body, **changes}, headers=self.headers)

    def fake_download(self, video_id, working_dir):
        self.assertEqual(video_id, "fixture")
        source = working_dir / "source.wav"
        with wave.open(str(source), "wb") as audio:
            audio.setnchannels(2)
            audio.setsampwidth(2)
            audio.setframerate(44100)
            audio.writeframes(b"\0" * 44100 * 4)
        return source, ["fixture warning"]

    def assert_normalized(self, audio_path):
        with wave.open(str(audio_path), "rb") as audio:
            self.assertEqual((audio.getnchannels(), audio.getframerate()), (1, 16000))
            self.assertAlmostEqual(audio.getnframes() / audio.getframerate(), 1)

    async def test_health_and_auth(self):
        health = await self.client.get("/health")
        self.assertEqual(health.status_code, 200)
        self.assertTrue(health.json()["workerSecretConfigured"])
        self.assertTrue(all(health.json()["binaries"].values()))
        self.assertTrue(all(health.json()["pythonPackages"].values()))
        with patch.object(server, "download_audio", side_effect=AssertionError("Auth must precede download")):
            missing = await self.client.post("/transcribe", json=self.body)
            wrong = await self.client.post("/transcribe", json=self.body, headers={"Authorization": "Bearer wrong"})
            self.assertEqual((missing.status_code, wrong.status_code), (401, 403))
            self.assertEqual((await self.post(provider="youtube_captions")).status_code, 400)
            self.assertEqual((await self.post(provider="invalid")).status_code, 422)

    async def test_faster_whisper_normalization_and_response(self):
        def transcribe(path, **kwargs):
            from faster_whisper.audio import decode_audio
            self.assert_normalized(path)
            self.assertEqual(decode_audio(path).shape, (16000,))
            self.assertTrue(kwargs["vad_filter"])
            return iter([SimpleNamespace(start=0, end=1, text=" Hello ")]), SimpleNamespace(language="en")
        with patch.object(server, "download_audio", side_effect=self.fake_download), patch.object(
            server, "get_faster_whisper_model", return_value=SimpleNamespace(transcribe=transcribe)
        ):
            response = await self.post()
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {
            "entries": [{"start": 0.0, "duration": 1.0, "text": "Hello"}],
            "fullText": "Hello", "estimatedCostUsd": None, "warnings": ["fixture warning"],
        })
        self.assertEqual(server.ACTIVE_JOBS, 0)

    async def test_sensevoice_real_postprocessor_with_simulated_model(self):
        def generate(**kwargs):
            from funasr.utils.load_utils import load_audio_text_image_video
            self.assert_normalized(kwargs["input"])
            audio = load_audio_text_image_video(kwargs["input"])
            self.assertEqual(tuple(audio.shape), (16000,))
            return [{"text": "Hello"}]
        with patch.object(server, "download_audio", side_effect=self.fake_download), patch.object(
            server, "get_sensevoice_model", return_value=SimpleNamespace(generate=generate)
        ):
            response = await self.post(provider="sensevoice")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["fullText"], "Hello")
        self.assertEqual(response.json()["entries"][0]["duration"], 1)
        self.assertEqual(len(response.json()["warnings"]), 2)

    async def test_openai_providers_multipart_and_cost(self):
        for provider, model, cost in [("openai", "gpt-4o-transcribe", 0.0001), ("openai_mini", "gpt-4o-mini-transcribe", 0.00005)]:
            with self.subTest(provider=provider):
                def reply(url, **kwargs):
                    self.assertEqual(url, "https://api.openai.com/v1/audio/transcriptions")
                    self.assertEqual(dict(kwargs["data"])["model"], model)
                    self.assertEqual(kwargs["headers"]["Authorization"], "Bearer synthetic")
                    self.assert_normalized(kwargs["files"]["file"][1].name)
                    return SimpleNamespace(status_code=200, json=lambda: {"text": "Hello", "segments": [{"start": 0, "end": 1, "text": "Hello"}]})
                with patch.object(server, "download_audio", side_effect=self.fake_download), patch.object(server.requests, "post", side_effect=reply):
                    response = await self.post(provider=provider, apiKey="synthetic")
                self.assertEqual(response.status_code, 200, response.text)
                self.assertEqual(response.json()["estimatedCostUsd"], cost)
                self.assertEqual(response.json()["entries"][0]["text"], "Hello")

    async def test_deepgram_text_fallback(self):
        result = {"results": {"channels": [{"alternatives": [{"transcript": "Hello"}]}]}}
        with patch.object(server, "download_audio", side_effect=self.fake_download), patch.object(
            server.requests, "post", return_value=SimpleNamespace(status_code=200, json=lambda: result)
        ):
            response = await self.post(provider="deepgram", apiKey="synthetic")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["entries"], [{"start": 0.0, "duration": 1.0, "text": "Hello"}])

    async def test_hard_limits_precede_download(self):
        with patch.object(server, "fetch_video_metadata", return_value={"duration": 61}), patch.object(
            server, "HARD_MAX_VIDEO_DURATION_SECONDS", 60
        ), patch.object(server, "run_command", side_effect=AssertionError("Oversized video must not download")):
            self.assertEqual((await self.post()).status_code, 413)
        with patch.object(server, "fetch_video_metadata", return_value={"filesize": 101}), patch.object(
            server, "HARD_MAX_AUDIO_DOWNLOAD_BYTES", 100
        ), patch.object(server, "run_command", side_effect=AssertionError("Oversized audio must not download")):
            self.assertEqual((await self.post()).status_code, 413)
        self.assertEqual(server.ACTIVE_JOBS, 0)

    async def test_busy_and_failure_release(self):
        with server.reserve_job_slot(), patch.object(server, "download_audio", side_effect=AssertionError("Busy worker must not download")):
            self.assertEqual((await self.post()).status_code, 429)
        with patch.object(server, "download_audio", side_effect=server.YtDlpBotGatedError("fixture bot gate")):
            self.assertEqual((await self.post()).status_code, 403)
        with patch.object(server, "download_audio", side_effect=self.fake_download), patch.object(
            server, "transcribe_with_provider", side_effect=RuntimeError("fixture provider failure")
        ):
            self.assertEqual((await self.post()).status_code, 500)
        self.assertEqual(server.ACTIVE_JOBS, 0)
        self.assertTrue(server.JOB_SEMAPHORE.acquire(blocking=False))
        server.JOB_SEMAPHORE.release()

    async def test_empty_transcript_fails(self):
        with patch.object(server, "download_audio", side_effect=self.fake_download), patch.object(
            server, "get_faster_whisper_model", return_value=SimpleNamespace(transcribe=lambda *args, **kwargs: (iter([]), SimpleNamespace(language="en")))
        ):
            response = await self.post()
        self.assertEqual(response.status_code, 500)
        self.assertEqual(server.ACTIVE_JOBS, 0)


class NativeDependencyTests(unittest.TestCase):
    def test_native_imports_and_cpu_pair(self):
        import torch
        import torchaudio
        from faster_whisper import WhisperModel
        from funasr import AutoModel
        self.assertEqual(torch.__version__, "2.14.0+cpu")
        self.assertEqual(torchaudio.__version__, "2.11.0+cpu")
        self.assertIsNone(torch.version.cuda)
        self.assertTrue(callable(WhisperModel))
        self.assertTrue(callable(AutoModel))

    def test_retained_openai_sdk_offline(self):
        import openai
        self.assertEqual(openai.__version__, "3.8.0")
        transport = httpx.MockTransport(lambda request: httpx.Response(200, json={"text": "Hello"}))
        with openai.OpenAI(api_key="synthetic", http_client=httpx.Client(transport=transport)) as client:
            transcript = client.audio.transcriptions.create(model="whisper-1", file=("test.wav", b"fixture"))
        self.assertEqual(transcript.text, "Hello")


if __name__ == "__main__":
    unittest.main()

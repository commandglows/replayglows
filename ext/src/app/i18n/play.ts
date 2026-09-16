// Play view localization. French keys are the source of truth; English mirrors them.
export const messages = {
  fr: {
    'play.title': 'Lecture',
    'play.backToFeed': 'Retour au fil',
    'play.chooseVideoTitle': 'Choisissez une vidéo',
    'play.chooseVideoDesc':
      'Ouvrez le fil, puis sélectionnez une vidéo synchronisée pour lancer la lecture.',
    'play.loadFailed': 'Impossible de charger la lecture.',
    'play.metadataUnavailable':
      'Les informations de cette vidéo sont introuvables dans votre bibliothèque.',
    'play.watched': 'Vu',
    'play.markWatched': 'Marquer comme vu',
    'play.markUnwatched': 'Marquer comme non vu',
    'play.resume': 'Reprendre',
    'play.resumeAt': 'Reprendre à {time}',
    'play.startOver': 'Recommencer du début',
    'play.noPosition': 'Aucune position sauvegardée. La lecture démarrera au début.',
    'play.savePosition': 'Enregistrer la position',
    'play.positionSeconds': 'Position (secondes)',
    'play.positionSaved': 'Position enregistrée.',
    'play.positionNotSaved': 'Impossible d’enregistrer la position.',
    'play.like': 'J’aime',
    'play.dislike': 'Je n’aime plus',
    'play.actionFailed': 'L’action a échoué.',
    'play.watchedUpdated': 'Statut mis à jour.',
    'play.watchedUpdateFailed': 'Impossible de mettre à jour le statut.',
  } as const,
  en: {
    'play.title': 'Player',
    'play.backToFeed': 'Back to feed',
    'play.chooseVideoTitle': 'Choose a video',
    'play.chooseVideoDesc':
      'Open the feed, then select a synced video to start playback.',
    'play.loadFailed': 'Could not load playback.',
    'play.metadataUnavailable':
      'This video’s details were not found in your library.',
    'play.watched': 'Watched',
    'play.markWatched': 'Mark as watched',
    'play.markUnwatched': 'Mark as not watched',
    'play.resume': 'Resume',
    'play.resumeAt': 'Resume at {time}',
    'play.startOver': 'Start over',
    'play.noPosition': 'No saved position. Playback will start at the beginning.',
    'play.savePosition': 'Save position',
    'play.positionSeconds': 'Position (seconds)',
    'play.positionSaved': 'Position saved.',
    'play.positionNotSaved': 'Could not save the position.',
    'play.like': 'Like',
    'play.dislike': 'Dislike',
    'play.actionFailed': 'The action failed.',
    'play.watchedUpdated': 'Status updated.',
    'play.watchedUpdateFailed': 'Could not update the status.',
  } as const,
} as const

export type PlayKey = keyof (typeof messages)['fr']
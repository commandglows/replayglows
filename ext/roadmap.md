# Plan de Migration vers TypeScript et Vue 3

Je vais vous proposer un plan structuré pour migrer votre extension Chrome de JavaScript vers TypeScript et Vue 3.

## 1. Préparation du Projet

1. **Configuration de l'environnement**
   - Installation de Vue 3 et TypeScript
   - Mise en place de Vite comme bundler (recommandé pour Vue 3)
   - Configuration du `tsconfig.json`
   - Mise à jour du `manifest.json` pour supporter les nouveaux fichiers

2. **Structure du Projet**
```
extension/
├── src/
│   ├── components/
│   ├── views/
│   ├── store/
│   ├── types/
│   ├── background/
│   ├── content/
│   └── popup/
├── public/
├── manifest.json
├── tsconfig.json
├── vite.config.ts
└── package.json
```

## 2. Plan de Migration par Étapes

### Étape 1 : Configuration Initiale
```bash
# Installation des dépendances
npm install vue@3 typescript @vitejs/plugin-vue vue-tsc @types/chrome
```

### Étape 2 : Configuration TypeScript
```typescript:tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["chrome"]
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.tsx", "src/**/*.vue"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### Étape 3 : Configuration Vite
```typescript:vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        background: resolve(__dirname, 'src/background/background.ts'),
        content: resolve(__dirname, 'src/content/content.ts')
      },
      output: {
        entryFileNames: '[name].js'
      }
    }
  }
})
```

## 3. Processus de Migration

1. **Migration Progressive**
   - Convertir les fichiers JS en TS un par un
   - Ajouter les types progressivement
   - Créer des composants Vue 3 pour remplacer le code UI existant

2. **Points d'Attention**
   - Utiliser la Composition API de Vue 3
   - Définir des interfaces pour les messages entre background et content scripts
   - Utiliser les types Chrome API

## 4. Exemple de Migration d'un Composant

```typescript:src/components/Example.vue
<script lang="ts">
import { defineComponent, ref } from 'vue'

interface Message {
  type: string;
  content: string;
}

export default defineComponent({
  name: 'Example',
  setup() {
    const messages = ref<Message[]>([])

    const sendMessage = async (message: Message) => {
      await chrome.runtime.sendMessage(message)
    }

    return {
      messages,
      sendMessage
    }
  }
})
</script>

<template>
  <div class="example">
    <!-- Template content -->
  </div>
</template>
```

## 5. Tests et Validation

1. **Tests Unitaires**
   - Mise en place de Vitest pour les tests
   - Tests des composants Vue avec @vue/test-utils

2. **Tests E2E**
   - Tests de l'extension dans Chrome
   - Vérification des fonctionnalités principales

## Recommandations

1. Faire la migration par petites étapes testables
2. Maintenir une version fonctionnelle à chaque étape
3. Utiliser les outils de type-checking de TypeScript strictement
4. Documenter les changements et les nouvelles interfaces
5. Mettre en place un système de CI/CD adapté

Voulez-vous que nous commencions par une étape particulière ou avez-vous des questions sur ce plan de migration ?

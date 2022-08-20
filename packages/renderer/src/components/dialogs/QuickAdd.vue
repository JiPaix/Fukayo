<script lang="ts" setup>
import type { socketClientInstance } from '@api/client/types';
import type { mirrorInfo } from '@api/models/types/shared';
import { useSocket } from '@renderer/components/helpers/socket';
import type en from '@renderer/locales/en.json';
import type { supportedLangsType } from '@renderer/locales/lib/supportedLangs';
import { useStore as useSettingsStore } from '@renderer/store/settings';
import { useDialogPluginComponent } from 'quasar';
import { computed, onBeforeMount, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';

/** dialog component setup */
const { dialogRef, onDialogOK, onDialogCancel } = useDialogPluginComponent();
defineEmits([
  ...useDialogPluginComponent.emits,
]);

const $t = useI18n<{message: typeof en}, supportedLangsType>().t.bind(useI18n());
/** stored settings */
const settings = useSettingsStore();
/** socket */
let socket:socketClientInstance|undefined;
/** user input */
const input = ref('');
/** does the input need a validation? */
const isInputNew = ref(false);
/** results from the server */
const results = ref<
  {
    mirror: mirrorInfo|undefined,
    manga: boolean,
    chapter: boolean
  }
  >({ mirror: undefined, manga: false, chapter: false});
/** selected language */
const selectedLanguage = ref<{label: string, value: string}|null>(null);
/** langs in mirror */
const availableLangs = computed(() => {
  if(results.value.mirror) {
    return results.value.mirror.langs.map((lang) => {
      return {
        label: $t(`languages.${lang}.value`),
        value: lang,
      };
    });
  }
  return [];
});
/** is the form ready to be processed by the server */
const isOk = computed(() => {
  if(!results.value.mirror) return false;
  if(!selectedLanguage.value) return false;
  if(!(results.value.mirror.langs as string[]).includes(selectedLanguage.value.value)) return false;
  return true;
});

/** reset values when user changes the input */
function saneInput(input:string|null|number) {
  isInputNew.value = true;
  results.value = {
    mirror: undefined,
    manga: false,
    chapter: false,
  };
  if(input === null) return '';
  if(typeof input === 'number') return input.toString();
  return input;
}

async function findMirrorbyUrl() {
  if(!socket) socket = await useSocket(settings.server);
  socket.emit('findMirrorByURL', input.value, (mirror, isMangaPage, isChapterPage) => {
    if(!mirror) showError($t('dialog.quickadd.no_match', { sourceWord: $t('mangas.source') }));
    results.value = {
      mirror,
      manga: isMangaPage,
      chapter: isChapterPage,
    };
    if(mirror) {
      selectedLanguage.value = {
        label: $t(`languages.${mirror.langs[0]}.value`),
        value: mirror.langs[0],
      };
    }
  });
}

async function showManga() {
  if(!isOk.value) return;
  // checking first if the form is completed
  if(!results.value.mirror) return;
  if(!selectedLanguage.value) return;
  if(!(results.value.mirror.langs as string[]).includes(selectedLanguage.value.value)) return;
  // if user inputed a chapter page, we need to get the manga url
  if(!socket) socket = await useSocket(settings.server);
  const reqId = Date.now();

  socket.on('getMangaURLfromChapterURL', (id, o) => {
    if(id !== reqId) return;
    socket?.off('getMangaURLfromChapterURL');
    if(o) {
      closeAndRedirect({
        mirror: o.mirror,
        lang: o.lang,
        url: o.url,
      });
    } else {
      showError($t('dialog.quickadd.bad_url'));
    }
  });
  socket.emit('getMangaURLfromChapterURL', reqId, input.value, selectedLanguage.value.value);
}

function closeAndRedirect(o:{ mirror: string, lang:string, url:string}) {
  const { mirror, lang, url} = o;
  onDialogOK({mirror, lang, url});
}

function showError(text:string) {
  console.log(text);
}

onBeforeMount(async () => {
  if(!socket) socket = await useSocket(settings.server);
});

onBeforeUnmount(() => {
  socket?.off('getMangaURLfromChapterURL');
});

</script>
<template>
  <!-- notice dialogRef here -->
  <q-dialog
    ref="dialogRef"
    :maximized="$q.screen.lt.md"
    @hide="onDialogCancel"
    @keyup.enter="showManga"
  >
    <q-card
      class="q-dialog-plugin"
      :dark="$q.dark.isActive"
    >
      <q-card-section class=" q-mb-lg">
        <span class="text-h5">
          {{ $t('dialog.quickadd.title') }}
        </span>
      </q-card-section>
      <q-card-section
        class="row q-mb-lg"
      >
        <q-input
          class="col-7"
          :model-value="input"
          type="text"
          :label="$t('dialog.quickadd.url')"
          :dark="$q.dark.isActive"
          @update:model-value="(v) => { input = saneInput(v); findMirrorbyUrl() }"
          @keydown="isInputNew = true"
        />

        <div
          v-if="results.mirror"
          class="col-4 q-ml-auto self-end"
        >
          <q-select
            v-model="selectedLanguage"
            transition-show="jump-left"
            :label="$t('languages.language.value', availableLangs.length)"
            filled
            dense
            options-dense
            :behavior="$q.screen.lt.md ? 'dialog' : 'default'"
            :options="availableLangs"
            :dark="$q.dark.isActive"
          />
        </div>
      </q-card-section>
      <q-card-actions
        align="right"
        class="q-mb-lg q-mr-lg"
        :class="$q.screen.lt.md ? 'absolute-bottom-right' : ''"
      >
        <q-btn
          class="q-mr-lg"
          flat
          :label="$t('setup.security.cancel')"
          @click="onDialogCancel"
        />
        <q-btn
          class="q-ml-lg"
          round
          color="orange"
          icon="send"
          :disable="!isOk"
          @click="showManga"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

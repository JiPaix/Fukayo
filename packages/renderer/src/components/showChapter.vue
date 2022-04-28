<script lang="ts" setup>
import { computed } from 'vue';
import { useDialogPluginComponent } from 'quasar';
import type { ChapterPage } from '../../../api/src/mirrors/types/chapter';
import type { ChapterPageErrorMessage, ChapterErrorMessage } from '../../../api/src/mirrors/types/errorMessages';
import type { MangaPage } from '../../../api/src/mirrors/types/manga';
import type { sock } from '../socketClient';

defineEmits([
  // REQUIRED; need to specify some events that your
  // component will emit through useDialogPluginComponent()
  ...useDialogPluginComponent.emits,
]);

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent();

// this is part of our example (so not required)
function onOKClick () {
  // on OK, it is REQUIRED to
  // call onDialogOK (with optional payload)
  onDialogOK();
  // or with payload: onDialogOK({ ... })
  // ...and it will also hide the dialog automatically
}

const props = defineProps<{
  socket: sock
  manga: MangaPage
  images: (ChapterPage | ChapterPageErrorMessage)[]
  pagination : { prev: () => void | null, next: () => void | null, current: MangaPage['chapters'][0], nbOfPages: number },
  error: ChapterErrorMessage
}>();

function isError(res: ChapterPage | ChapterPageErrorMessage): res is ChapterPageErrorMessage {
  return (res as ChapterPageErrorMessage).error !== undefined;
}

function sortImage(chapter: (ChapterPage | ChapterPageErrorMessage)[]) {
  return chapter.sort((a, b) => a.index - b.index);
}

const sortedImages = computed(() => {
  return sortImage(props.images);
});

</script>
<template>
  <q-dialog
    ref="dialogRef"
    maximized
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin">
      <h1 v-if="pagination.current">
        {{ pagination.current.number || '' }} - {{ pagination.current.name }}
      </h1>
      <q-btn
        v-if="typeof pagination.prev === 'function'"
        color="white"
        text-color="black"
        label="Prev"
        @click="pagination.prev"
      />

      <q-btn
        v-if="typeof pagination.next === 'function'"
        label="Next"
        @click="pagination.next"
      />
      <p>NB OF IMAGES: {{ images.length }} / {{ pagination.nbOfPages }}</p>
      <q-card
        v-for="(image, index) in sortedImages"
        :key="index"
        class="q-pa-xl"
      >
        <q-img
          :src="(image as ChapterPage).src"
        />
        <h3 v-if="image.lastpage">
          THIS WAS THE LAST PAGE
        </h3>
      </q-card>
      <!--
        ...content
        ... use q-card-section for it?
      -->

      <!-- buttons example -->
      <q-card-actions align="right">
        <q-btn
          color="primary"
          label="OK"
          @click="onOKClick"
        />
        <q-btn
          color="primary"
          label="Cancel"
          @click="onDialogCancel"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

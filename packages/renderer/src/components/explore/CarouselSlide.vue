<script setup lang="ts">
import type { appLangsType } from '@i18n';
import type en from '@i18n/../locales/en.json';
import { useI18n } from 'vue-i18n';
import notfound from '@assets/404_portrait.svg';

defineProps<{
  cover?: string
  groupName: string
  groupInLibrary: boolean
  mirrorIcon: string
  mirrorDisplayName: string
  name: string|number
}>();

// config
const
/** i18n */
$t = useI18n<{message: typeof en}, appLangsType>().t.bind(useI18n());
</script>

<template>
  <q-carousel-slide
    :name="name"
    :img-src="cover || notfound"
  >
    <div
      class="absolute-top-left w-100 text-white q-px-sm"
      style="background-color: rgba(29, 29, 29, 0.8) !important;"
    >
      <div class="flex justify-between items-center ellipsis">
        <div class="flex flex-center">
          <q-img
            :src="mirrorIcon"
            width="16px"
            height="16px"
          />
          <span class="text-caption q-ml-sm">
            {{ mirrorDisplayName }}
          </span>
        </div>
        <q-badge
          v-if="groupInLibrary"
          color="red"
        >
          {{ $t('mangas.inlibrary') }}
        </q-badge>
      </div>
    </div>
    <div
      class="absolute-bottom w-100 ellipsis text-white text-center q-px-sm"
      style="background-color: rgba(29, 29, 29, 0.49) !important;"
    >
      <span class="text-h6">{{ groupName }}</span>
      <q-tooltip
        anchor="bottom middle"
        self="top middle"
        :offset="[10, 10]"
      >
        {{ groupName }}
      </q-tooltip>
    </div>
  </q-carousel-slide>
</template>

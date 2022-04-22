<script lang="ts" setup>
import { computed } from 'vue';
import { useQuasar } from 'quasar';
import type { SearchResult } from '../../../api/src/mirrors/types/search';

const $q = useQuasar();

defineProps<{
  results: SearchResult[]
  loading: boolean
}>();

function showSynopsis (title:string, synopsis: string) {
  $q.dialog({
    title: title,
    message: synopsis,
  }).onOk(() => {
    // console.log('OK')
  }).onCancel(() => {
    // console.log('Cancel')
  }).onDismiss(() => {
    // console.log('I am triggered on both OK and Cancel')
  });
}

const sizes = computed(() => {
  const classes = [];
  if($q.screen.lt.sm) classes.push('h-xs');
  else classes.push('h-lg');
  if($q.screen.gt.sm) classes.push('q-gutter-x-xl');
  return classes.join(' ');
});

const emit = defineEmits<{
  (event: 'showManga', item:SearchResult): void
}>();

const showManga = (item:SearchResult) => {
  emit('showManga', item);
};

</script>

<template>
  <div class="q-pa-md row justify-evenly">
    <q-intersection
      v-for="item in results"
      :key="item.link"
      class="col-xs-12 col-sm-5 q-mt-xl col-lg-3"
      :class="sizes"
      margin="500px 500px 500px 500px"
      transition="fade"
    >
      <div
        class="row shadow-5 overflow-hidden"
        :class="$q.screen.lt.sm ? 'h-xs' : 'h-lg'"
      >
        <div
          v-if="item.covers.length > 0"
          class="col-xs-12 col-sm-6 cover flex cursor-pointer"
          :style="'background-image: url('+item.covers[0]+');'"
          :class="$q.screen.lt.sm ? 'xs-cover' : ''"
          @click="showManga(item)"
        >
          <div
            class="text-center text-white q-pa-md text-h6 self-end w-100 ellipsis"
            style="overflow-hidden;bottom:0;background-color:rgb(29 29 29 / 49%)!important;"
            rounded
            dense
          >
            {{ item.name }}
            <q-tooltip>
              {{ item.name }}
            </q-tooltip>
          </div>
        </div>
        <q-skeleton
          v-else
          class="col-xs-12 col-sm-6 cover flex cursor-pointer"
          :class="$q.screen.lt.sm ? 'xs-cover' : ''"
          @click="showManga(item)"
        >
          <div
            class="text-center text-white q-pa-md text-h6 self-end w-100 ellipsis"
            style="overflow-hidden;bottom:0;background-color:rgb(29 29 29 / 49%)!important;"
            rounded
            dense
          >
            {{ item.name }}
            <q-tooltip>
              {{ item.name }}
            </q-tooltip>
          </div>
        </q-skeleton>
        <div
          class="col-xs-12 col-sm-6"
        >
          <div
            v-if="item.last_release"
            class="q-pa-sm flex column"
            :class="$q.screen.gt.xs ? 'h-lg':''"
          >
            <div
              v-if="(item.last_release.name !== undefined && item.last_release.chapter === undefined) || $q.screen.lt.sm"
              class="bg-orange text-white text-center q-pa-md rounded-borders w-100 text-weight-medium"
            >
              <span v-if="item.last_release.chapter !== undefined">
                {{ $t('mangas.chapter.value').toLocaleUpperCase() }} {{ item.last_release.chapter }}
              </span>
              <span v-if="item.last_release.chapter !== undefined && item.last_release.name !== undefined">
                -
              </span>
              <span v-if="item.last_release.name !== undefined">
                {{ item.last_release.name }}
              </span>
            </div>
            <div
              v-if="item.last_release.volume !== undefined && ($q.screen.sm || $q.screen.gt.sm)"
              class="row q-ma-sm shadow-1"
            >
              <div
                class="col-4 q-py-sm bg-orange text-center text-weight-medium text-black"
                style="border-top-left-radius:3px;border-bottom-left-radius: 3px;"
              >
                {{ item.last_release.volume }}
              </div>
              <div class="col-8 q-py-sm text-center text-uppercase text-weight-medium">
                {{ $t('mangas.volume.value') }}
              </div>
            </div>

            <div
              v-if="item.last_release.chapter !== undefined && ($q.screen.sm || $q.screen.gt.sm)"
              class="row q-ma-sm shadow-1"
            >
              <div
                class="col-4 q-py-sm bg-orange text-center text-weight-medium"
                style="border-top-left-radius:3px;border-bottom-left-radius: 3px;"
              >
                {{ item.last_release.chapter }}
              </div>
              <div class="col-8 q-py-sm text-center text-uppercase text-weight-medium">
                {{ $t('mangas.chapter.value') }}
              </div>
            </div>

            <div
              v-if="item.synopsis !== undefined && ($q.screen.sm || $q.screen.gt.sm)"
              v-ripple
              class="row q-ma-sm shadow-1"
              @click="showSynopsis(item.name, item.synopsis!)"
            >
              <div
                class="col-4 q-py-sm bg-info text-center"
                style="border-top-left-radius:3px;border-bottom-left-radius: 3px;"
              >
                <q-icon
                  name="o_feed"
                  size="1.5em"
                />
              </div>
              <div class="col-8 q-py-sm text-center text-uppercase text-weight-medium">
                {{ $t('mangas.synopsis.value') }}
              </div>
            </div>
            <div
              v-if="$q.screen.gt.sm || $q.screen.sm"
              class="text-center q-mt-auto q-mb-xl"
            >
              <q-btn
                round
                :class="$q.screen.lt.sm ? 'q-mx-lg' : 'q-mx-sm'"
                :size="$q.screen.lt.sm ? 'lg' : 'md'"
                icon="add"
                text-color="white"
                color="orange"
              />
              <q-btn
                round
                color="primary"
                text-color="white"
                :class="$q.screen.lt.sm ? 'q-mx-lg' : 'q-mx-sm'"
                :size="$q.screen.lt.sm ? 'lg' : 'md'"
                icon="visibility"
                @click="showManga(item)"
              />
            </div>
          </div>


          <div class="absolute-bottom-right flex items-center">
            <img
              width="16"
              height="16"
              :src="item.mirrorinfo.icon"
            >
            <div
              style="height:16px;width:22px;"
              :class="'glow q-ma-sm fi fi-'+$t('languages.'+item.lang+'.flag')"
            />
          </div>
        </div>
      </div>
    </q-intersection>
  </div>
</template>
<style lang="css" scoped>
.cover {
  background-repeat: no-repeat;
  background-size:cover;
  background-position: 50% 50%;
}

.h-lg {
  height: 300px!important;
}
.h-xs {
  height: 530px!important;
}
.xs-cover {
  height:400px!important;
}
</style>

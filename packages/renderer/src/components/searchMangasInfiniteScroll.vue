<script lang="ts" setup>
import { useQuasar } from 'quasar';
import 'flag-icons';

const $q = useQuasar();

type results = {
    mirrorinfo: {
        name: string;
        displayName: string;
        host: string;
        enabled: boolean;
        icon: string;
        langs: string[];
    };
    mirror: string;
    lang: string;
    name: string;
    link: string;
    cover?: string | undefined;
    synopsis?: string | undefined;
    last_release?: {
        name?:string
        volume?:number
        chapter?:number
    }
  }[]
defineProps<{
  results: results
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


</script>

<template>
  <div class="q-pa-md row justify-evenly">
    <q-intersection
      v-for="item in results"
      :key="item.name"
      class="col-xs-12 col-sm-5 q-mt-xl"
      :class="$q.screen.lt.sm ? 'h600' : 'h300'"
      margin="500px 500px 500px 500px"
      transition="fade"
    >
      <div
        class="row shadow-5 overflow-hidden cursor-pointer"
        :class="$q.screen.lt.sm ? 'h600' : 'h300'"
      >
        <div
          class="col-xs-12 col-sm-6 cover flex"
          :style="'background-image: url('+item.cover+');'"
          :class="$q.screen.lt.sm ? 'xs-cover' : ''"
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

        <div class="col-xs-12 col-sm-6">
          <div v-if="item.last_release">
            <div class="q-pa-sm flex column">
              <div
                v-if="item.last_release.name !== undefined && item.last_release.chapter === undefined"
                style="font-size:1.2rem;"
                class="bg-orange text-white text-center q-pa-md rounded-borders w-100"
              >
                {{ item.last_release.name }}
              </div>
              <q-btn-group
                v-if="item.last_release.volume !== undefined"
                class="q-mb-sm"
              >
                <q-btn
                  round
                  color="orange"
                  text-color="dark"
                >
                  {{ item.last_release.volume }}
                </q-btn>
                <q-btn>
                  Volume
                </q-btn>
              </q-btn-group>

              <q-btn-group
                v-if="item.last_release.chapter !== undefined"
                class="q-mb-sm"
              >
                <q-btn
                  round
                  color="orange"
                >
                  {{ item.last_release.chapter }}
                </q-btn>
                <q-btn>
                  chapter
                </q-btn>
              </q-btn-group>

              <q-btn-group
                v-if="item.synopsis !== undefined"
                class="q-mb-sm"
                @click="showSynopsis(item.name, item.synopsis!)"
              >
                <q-btn
                  round
                  color="info"
                  icon="o_feed"
                />
                <q-btn>
                  Synopsis
                </q-btn>
              </q-btn-group>
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

.h300 {
  height: 300px!important;
}
.h600 {
  height: 600px!important;
}
.xs-cover {
  height:370px!important;
}
</style>

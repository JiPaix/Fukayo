<script lang="ts" setup>
  import { ref, watch, computed, onMounted } from 'vue';
  import type { SearchErrorMessage } from '../../../api/src/mirrors/types/errorMessages';
  import type { SearchResult } from '../../../api/src/mirrors/types/search';
  import type { sock } from '../socketClient';

  const props = defineProps<{
    logo: string;
    socket: sock
  }>();

  const mirrorsList = ref([] as {
    name: string;
    host: string;
    enabled: boolean;
    icon: string;
  }[]);

  onMounted(() => {
    props.socket.emit('getMirrors', (mirrors) => {
      mirrorsList.value = mirrors;
    });
  });

  const leftDrawerOpen = ref(true);

  /**
   * ################
   * #### SEARCH ####
   * ################
   */

  // search refs
  const searchQuery = ref('');
  const searchQueryInResults = ref('');
  const searchShow = ref(false);
  const searchResultsRaw = ref([] as (SearchResult)[]);

  // Typescript hack to differentiate between searchResults and searchErrorMessages
  function isSearchResult(res: SearchResult | SearchErrorMessage): res is SearchResult {
    return (res as SearchResult).link !== undefined;
  }

  // trigger search
  function research() {
    searchShow.value = false;
    if(!searchQuery.value || searchQuery.value.length < 3) return;
    searchQueryInResults.value = searchQuery.value;
    searchResultsRaw.value = [];
    const now = Date.now();
    props.socket.emit('searchInMirrors', searchQuery.value, now);
    searchShow.value = true;
    const listener = (id:number, res?:SearchResult | SearchErrorMessage) => {
      if(id === now) {

        if(res && isSearchResult(res)) searchResultsRaw.value.push(res);
      }
    };
    props.socket.on('searchInMirrors', listener);
  }

  // reset search results when search card is closed
  watch(searchShow, (currentState) => {
    if(currentState === false) {
      props.socket.removeAllListeners('searchInMirrors'); // also remove listener
      searchResultsRaw.value = [];
    }
  });

  // computed search results (just adds mirrorinfo to each result)
  const searchResults = computed(() => {
    return searchResultsRaw.value.map(r => {
      const mirrorinfo = mirrorsList.value.find(m => m.name === r.mirror);
      if(!mirrorinfo) throw Error('mirrorinfo not found');
        return {
          ...r,
          mirrorinfo,
        };
    });
  });

</script>

<template>
  <q-layout view="hHh lpR fFf">
    <q-header
      elevated
      class="bg-grey-10 text-white"
      height-hint="98"
    >
      <q-toolbar>
        <q-btn
          dense
          flat
          round
          icon="menu"
          @click="leftDrawerOpen = !leftDrawerOpen"
        />

        <q-toolbar-title>
          <q-img
            :src="props.logo"
            width="40px"
            height="40px"
            fit="scale-down"
          />
          {{ $t('app.name.value') }}
        </q-toolbar-title>
      </q-toolbar>

      <q-tabs align="left">
        <q-route-tab
          label="Page One"
        />
        <q-route-tab
          label="Page Two"
        />
        <q-route-tab
          label="Page Three"
        />
        <q-input
          v-model="searchQuery"
          rounded
          outlined
          dense
          class="q-ml-auto q-mr-md"
          placeholder="Search"
          clearable
          @keyup.enter="research"
        >
          <template
            v-if="!searchQuery"
            #append
          >
            <q-icon
              :name="'search'"
              style="cursor:pointer"
              @click="research"
            />
          </template>
        </q-input>
      </q-tabs>
    </q-header>

    <q-drawer
      v-model="leftDrawerOpen"
      side="left"
      bordered
      :width="200"
      :breakpoint="700"
      class="bg-dark"
    >
      ij
      <!-- drawer content -->
    </q-drawer>

    <q-page-container>
      <q-card
        v-if="searchShow"
        class="q-ma-md"
      >
        <q-card-section class="d-flex">
          <div class="text-h5">
            Search Results for: {{ searchQueryInResults }}
          </div>
          <q-avatar
            class="bg-black text-orange absolute-right q-ma-sm"
            size="20px"
            style="cursor:pointer;"
            @click="searchShow = false"
          >
            <q-icon
              name="cancel"
              size="20px"
            />
          </q-avatar>
        </q-card-section>
        <q-card-section>
          <q-virtual-scroll
            style="max-height: 340px;"
            :items="searchResults"
            separator
          >
            <template #default="{item}">
              <q-card
                v-ripple
                class="q-ma-md row"
                style="cursor:pointer;height: 150px!important;overflow: hidden;"
              >
                <div class="flex">
                  <img
                    :src="item.cover"
                    fit="scale-down"
                    style="width: 100px;height: 150px;"
                  >
                </div>
                <div class="col">
                  <div class="q-ml-sm">
                    <span class="text-h6">
                      {{ item.name }}
                      <q-avatar size="16px">
                        <img
                          :src="item.mirrorinfo.icon"
                          small
                        >
                        <q-tooltip
                          anchor="top right"
                          self="center middle"
                        >
                          {{ item.mirror }}
                        </q-tooltip>
                      </q-avatar>
                    </span>

                    <div v-if="item.last_release">
                      <q-chip
                        v-if="item.last_release.volume !== undefined"
                        color="teal"
                        dense
                      >
                        Volume: {{ item.last_release.volume }}
                      </q-chip>
                      <q-chip
                        v-if="item.last_release.chapter !== undefined"
                        color="teal"
                        dense
                      >
                        Chapter: {{ item.last_release.chapter }}
                      </q-chip>
                      <q-chip
                        v-if="item.last_release.name !== undefined"
                        color="teal"
                        dense
                      >
                        Name: {{ item.last_release.name }}
                      </q-chip>
                    </div>


                    <div class="caption q-mt-md ellipsis-3-lines q-pr-lg">
                      {{ item.synopsis }}
                    </div>
                  </div>
                </div>
              </q-card>
            </template>
          </q-virtual-scroll>

          <!-- <q-list>
            <q-item
              v-for="item in searchResults"
              :key="item.mirror"
              v-ripple
              clickable
            >
              <q-item-section avatar>
                <q-avatar
                  v-if="item.cover"
                  rounded
                >
                  <q-img
                    :src="item.cover"
                    lazy
                  />
                </q-avatar>
                <q-skeleton
                  v-else
                  height="40px"
                  width="40px"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ item.name }}</q-item-label>
                <q-item-label
                  caption
                  lines="2"
                >
                  {{ item.synopsis }}
                </q-item-label>
              </q-item-section>
              <q-separator vertical />
              <q-item-section
                side
                top
              >
                <q-avatar size="xs">
                  <img :src="item.mirrorinfo.icon">
                  <q-tooltip>
                    {{ item.mirrorinfo.name }}
                  </q-tooltip>
                </q-avatar>

                <q-chip
                  v-if="item.last_release?.volume && item.last_release?.chapter"
                  dense
                >
                  Vol.{{ item.last_release.volume }} - Ch.{{ item.last_release.chapter }}
                </q-chip>
                <q-chip
                  v-else-if="!item.last_release?.volume && item.last_release?.chapter"
                  dense
                >
                  Ch.{{ item.last_release.chapter }}
                </q-chip>
                <q-chip
                  v-else-if="!item.last_release?.volume && !item.last_release?.chapter && item.last_release?.name"
                  dense
                >
                  {{ item.last_release.name }}
                </q-chip>
              </q-item-section>
            </q-item>
          </q-list> -->
        </q-card-section>
      </q-card>
    </q-page-container>
  </q-layout>
</template>
<style lang="css">
  .drawer, aside {
    background-color: #ff9800!important;
  }
</style>

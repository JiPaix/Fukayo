<script lang="ts" setup>
import type { mirrorInfo } from '@api/models/types/shared';
import { transformIMGurl } from '@renderer/components/helpers/transformIMGurl';
import type { MangaInDBwithLabel } from '@renderer/components/library/@types';
import { useStore as useSettingsStore } from '@renderer/stores/settings';
import type { Ref } from 'vue';
import { ref } from 'vue';

/** props */
const props = defineProps<{
  manga: (MangaInDBwithLabel & {
    covers: string[];
    mirrorDisplayName: string;
    mirrorIcon: string;
  })
  mirrors:mirrorInfo[]
  disabled: boolean
}>();

/** emits */
const emit = defineEmits<{
  (eventName: 'search', payload: { origin: typeof props.manga, mirrors: string[], loader: Ref<boolean> }): void
}>();

// config
const
/** user settings */
settings = useSettingsStore();

// states
const
/** carousel slider */
slide = ref(0),
/** loading */
loading = ref(false),
/** selected migration mirror */
migrationMirror = ref<mirrorInfo[]|null>(null);

function search() {
  if(!migrationMirror.value) return;
  loading.value = true;
  emit('search', { origin: props.manga, mirrors: migrationMirror.value.map(m=>m.name), loader: loading });
}
</script>
<template>
  <div class="row q-mx-sm w-100 ">
    <div
      class="col-sm-3 col-xs-8 col-lg-2 q-my-lg"
      :class="$q.screen.lt.lg ? 'q-ml-auto q-mr-auto' : undefined"
    >
      <q-carousel
        v-model="slide"
        class="rounded-borders"
        autoplay
        animated
        infinite
      >
        <q-carousel-slide
          v-for="(mangaCover, ci) in manga.covers"
          :key="ci"
          :name="ci"
          :img-src="transformIMGurl(mangaCover, settings)"
        />
      </q-carousel>
    </div>
    <div
      class="col-sm-9 col-xs-12 q-px-lg q-my-lg"
    >
      <q-list
        padding
      >
        <q-item>
          <q-item-section
            top
            avatar
          >
            <q-avatar
              color="primary"
              text-color="white"
              icon="menu_book"
            />
          </q-item-section>

          <q-item-section>
            <q-item-label>{{ $t('mangas.title') }}</q-item-label>
            <q-item-label caption>
              {{ manga.name }}
            </q-item-label>
            <q-item-label
              v-if="manga.displayName"
              caption
            >
              ( {{ manga.displayName }} )
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-separator
          spaced
          inset="item"
        />
        <q-item>
          <q-item-section
            top
            avatar
          >
            <q-avatar
              color="primary"
              text-color="white"
              icon="cloud"
            />
          </q-item-section>

          <q-item-section>
            <q-item-label>{{ $t('mangas.source') }}</q-item-label>
            <q-item-label
              caption
            >
              <q-icon
                :name="'img:'+manga.mirrorIcon"
                size="16px"
              />
              {{ manga.mirrorDisplayName }}
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-separator
          spaced
          inset="item"
        />
        <q-item>
          <q-item-section
            top
            avatar
          >
            <q-avatar
              color="primary"
              text-color="white"
              icon="translate"
            />
          </q-item-section>

          <q-item-section>
            <q-item-label>{{ $t('languages.language', manga.langs) }}</q-item-label>
            <q-item-label
              caption
            >
              <q-btn
                v-for="(currLang, il) in manga.langs"
                :key="il"
                dense
                size="sm"
                :color="$q.dark.isActive ? 'orange' : 'dark'"
                class="q-mr-sm q-mb-sm"
              >
                {{ $t(`languages.${currLang}`) }}
              </q-btn>
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-separator
          spaced
          inset="item"
        />
        <q-item>
          <q-item-section
            top
            avatar
          >
            <q-avatar
              color="negative"
              text-color="white"
              icon="bug_report"
            />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ $t('migrate.bug') }}</q-item-label>
            <q-item-label caption>
              <span>
                {{ $t('migrate.mirror_status') }}:
              </span>
              <span
                v-if="manga.dead"
                class="text-negative"
              >
                ✖
              </span>
              <span
                v-else
                class="text-positive"
              >✔</span>
            </q-item-label>
            <q-item-label caption>
              <span>
                {{ $t('migrate.entry_status') }}:
              </span>
              <span
                v-if="manga.broken"
                class="text-negative"
              >
                ✖
              </span>
              <span
                v-else
                class="text-positive"
              >
                ✔
              </span>
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-separator
          spaced
          inset="item"
        />
        <q-item>
          <q-item-section
            top
            avatar
          >
            <q-avatar
              color="positive"
              text-color="white"
              icon="swap_horiz"
            />
          </q-item-section>

          <q-item-section>
            <q-item-label>{{ $t('migrate.solutions') }}</q-item-label>
            <q-item-label
              caption
            >
              <q-select
                v-model="migrationMirror"
                :options="mirrors.filter(m => manga.dead ? manga.mirror !== m.name : true).map(m => { return {...m, matching: m.langs.filter(l => manga.langs.includes(l)).length }})"
                multiple
                :label="$t('migrate.select_mirror')"
              >
                <template #option="scope">
                  <q-item v-bind="scope.itemProps">
                    <q-item-section avatar>
                      <q-icon :name="`img:${scope.opt.icon}`" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>{{ scope.opt.displayName }}</q-item-label>
                      <q-item-label caption>
                        <span
                          v-if="scope.opt.matching === 0"
                          class="text-negative"
                        >
                          {{ $t('migrate.source_do_not_have_lang') }}
                        </span>
                      </q-item-label>
                    </q-item-section>
                  </q-item>
                </template>
                <template #selected-item="scope">
                  <div class="flex flex-center q-mx-sm">
                    <q-icon
                      class="q-mr-xs"
                      :name="`img:${scope.opt.icon}`"
                    />
                    <span>{{ scope.opt.displayName }}</span>
                  </div>
                </template>
              </q-select>
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </div>
    <q-btn
      class="w-100"
      :disable="!migrationMirror || !migrationMirror.length || disabled"
      :loading="loading"
      color="orange"
      @click="search"
    >
      {{ $t('migrate.search_candidates') }}
    </q-btn>
  </div>
</template>

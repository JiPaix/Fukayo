<script lang="ts" setup>
import { computed } from 'vue';
import { useStore as useStoreSettings} from '/@/store/settings';
const settings = useStoreSettings();


const longStripIcon = computed(() => {
  return settings.reader.longStrip ? 'swipe_vertical' : 'queue_play_next';
});

const webtoonIcon = computed(() => {
  return settings.reader.webtoon ? 'smartphone' : 'aod';
});

const preloadIcon = computed(() => {
  return settings.reader.preloadNext ? 'signal_cellular_alt' : 'signal_cellular_alt_2_bar';
});

const showPageNumberIcon = computed(() => {
  return settings.reader.showPageNumber ? 'visibility' : 'visibility_off';
});

</script>
<template>
  <q-card
    flat
    class="w-100"
  >
    <q-card-section>
      <q-list
        :dark="settings.theme === 'dark'"
        separator
      >
        <q-expansion-item
          label="READER"
          class="shadow-2"
        >
          <q-list
            separator
          >
            <q-banner class="bg-primary text-white">
              {{ $t('settings.reader.info') }}
            </q-banner>
            <q-item
              style="background:rgba(255, 255, 255, 0.05)"
              class="flex items-center"
              :dark="settings.theme === 'dark'"
              clickable
              @click="settings.reader.preloadNext = !settings.reader.preloadNext"
            >
              <q-item-section>
                <q-item-label>
                  {{ $t('settings.reader.preload') }}
                </q-item-label>
              </q-item-section>
              <q-item-section
                side
              >
                <q-toggle
                  v-model="settings.reader.preloadNext"
                  :icon="preloadIcon"
                  size="lg"
                />
              </q-item-section>
            </q-item>
            <q-item
              style="background:rgba(255, 255, 255, 0.05)"
              class="flex items-center"
              :dark="settings.theme === 'dark'"
              clickable
              @click="settings.reader.longStrip = !settings.reader.longStrip"
            >
              <q-item-section>
                <q-item-label>
                  {{ $t('reader.longstrip') }}
                </q-item-label>
              </q-item-section>
              <q-item-section
                side
              >
                <q-toggle
                  v-model="settings.reader.longStrip"
                  :icon="longStripIcon"
                  size="lg"
                />
              </q-item-section>
            </q-item>
            <q-item
              style="background:rgba(255, 255, 255, 0.05)"
              class="flex items-center"
              :dark="settings.theme === 'dark'"
              clickable
              @click="settings.reader.webtoon = !settings.reader.webtoon"
            >
              <q-item-section>
                <q-item-label>
                  {{ $t('reader.webtoon') }}
                </q-item-label>
              </q-item-section>
              <q-item-section
                side
              >
                <q-toggle
                  v-model="settings.reader.webtoon"
                  :disable="settings.reader.zoomMode === 'fit-height'"
                  :icon="webtoonIcon"
                  size="lg"
                />
              </q-item-section>
            </q-item>
            <q-item
              style="background:rgba(255, 255, 255, 0.05)"
              class="flex items-center"
              :dark="settings.theme === 'dark'"
              clickable
              @click="settings.reader.webtoon = !settings.reader.webtoon"
            >
              <q-item-section>
                <q-item-label>
                  {{ $t('reader.showpagenumber') }}
                </q-item-label>
              </q-item-section>
              <q-item-section
                side
              >
                <q-toggle
                  v-model="settings.reader.showPageNumber"
                  :icon="showPageNumberIcon"
                  size="lg"
                />
              </q-item-section>
            </q-item>
            <q-item
              style="background:rgba(255, 255, 255, 0.05)"
              class="flex items-center"
              :dark="settings.theme === 'dark'"
              clickable
            >
              <q-item-section>
                <q-item-label>
                  {{ $t('reader.displaymode.value') }}
                </q-item-label>
              </q-item-section>
              <q-item-section
                side
              >
                <q-btn-group class="q-ml-auto q-mr-auto justify-center">
                  <q-btn
                    icon="width_wide"
                    :color="settings.reader.zoomMode === 'auto' ? 'orange' : undefined"
                    @click="settings.reader.zoomMode = 'auto'"
                  >
                    <q-tooltip>
                      {{ $t('reader.displaymode.auto') }}
                    </q-tooltip>
                  </q-btn>
                  <q-btn
                    icon="fit_screen"
                    :color="settings.reader.zoomMode === 'fit-width' ? 'orange' : undefined"
                    @click="settings.reader.zoomMode = 'fit-width'"
                  >
                    <q-tooltip>
                      {{ $t('reader.displaymode.fit-width') }}
                    </q-tooltip>
                  </q-btn>

                  <div class="q-pa-none q-ma-none no-box-shadows">
                    <q-btn
                      icon="height"
                      :text-color="settings.reader.webtoon ? 'negative' : undefined"
                      :color="settings.reader.zoomMode === 'fit-height' ? 'orange' : undefined"
                      :disable="settings.reader.webtoon"
                      @click="settings.reader.zoomMode = 'fit-height';settings.reader.webtoon = false"
                    />
                    <q-tooltip>
                      {{ $t('reader.displaymode.fit-height') }} ({{ settings.reader.webtoon ? $t('reader.displaymode.compatibility') : '' }})
                    </q-tooltip>
                  </div>
                  <q-btn
                    icon="pageview"
                    :color="settings.reader.zoomMode === 'custom' ? 'orange' : undefined"
                    @click="settings.reader.zoomMode = 'custom'"
                  >
                    <q-tooltip>
                      {{ $t('reader.displaymode.fit-custom') }}
                    </q-tooltip>
                  </q-btn>
                </q-btn-group>
              </q-item-section>
            </q-item>
          </q-list>
        </q-expansion-item>
      </q-list>
    </q-card-section>
  </q-card>
</template>
<style lang="css" scoped>
 .no-box-shadows > .q-btn:before {
    box-shadow: none!important;
 }
</style>

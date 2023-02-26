
import { useStore as useStoreSettings } from '@renderer/stores/settings';

const settings = useStoreSettings();

/** make sure options are compatible with each others */
export async function checkSettingsCompatibilty(key: keyof typeof settings.reader) {

  if(key === 'book' && settings.reader.book) {
    if(settings.reader.zoomMode === 'stretch-height' && settings.reader.longStripDirection === 'vertical') settings.reader.zoomMode = 'auto';
    if(settings.reader.webtoon) settings.reader.webtoon = false;
    if((!settings.reader.longStrip && settings.reader.book) || (settings.reader.longStrip && settings.reader.longStripDirection === 'vertical')) {
      if(settings.reader.zoomMode === 'stretch-height') settings.reader.zoomMode = 'auto';
    }
  }

  if(key === 'longStrip' && !settings.reader.longStrip) {
    settings.reader.webtoon = false;
  }

  if(key === 'webtoon' && settings.reader.webtoon) {
    if(settings.reader.zoomMode === 'stretch-height') settings.reader.zoomMode = 'auto';
  }

  if(key === 'longStripDirection' && settings.reader.longStripDirection === 'vertical') {
    if(settings.reader.book && settings.reader.zoomMode === 'stretch-height') settings.reader.zoomMode = 'auto';
  }

  if(key === 'longStripDirection' && settings.reader.longStripDirection === 'horizontal') {
    if(settings.reader.zoomMode === 'stretch-width') settings.reader.zoomMode = 'auto';
  }
}

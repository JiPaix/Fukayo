import {mount} from '@vue/test-utils';
import {expect, test} from 'vitest';
import ReactiveCounter from '../src/components/ReactiveCounter.vue';

test('ReactiveHash component', async () => {
  expect(ReactiveCounter).toBeTruthy();
  const wrapper = mount(ReactiveCounter);

  const button = wrapper.get('button');

  expect(button.text()).toBe('Beta 43 count 0');
  await button.trigger('click');
  expect(button.text()).toBe('Beta 43 count 1');
});

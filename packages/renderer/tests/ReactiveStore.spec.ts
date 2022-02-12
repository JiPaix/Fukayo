import {mount} from '@vue/test-utils';
import {expect, test} from 'vitest';
import ReactiveStore from '../src/components/ReactiveStore.vue';

test('ReactiveStore component', async () => {
  expect(ReactiveStore).toBeTruthy();
  const wrapper = mount(ReactiveStore);

  const name = wrapper.get('#name');
  expect(name.text()).toBe('Mr. No name');

  const loadName = wrapper.get('#load-name');
  await loadName.trigger('click');
  await new Promise(resolve => setTimeout(resolve, 500));
  expect(name.text()).toBe('Mr. John');

  const input = wrapper.get('#input-name');
  await input.setValue('Smith');
  expect(name.text()).toBe('Mr. Smith');
});

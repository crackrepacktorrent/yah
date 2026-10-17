import { render } from '@solidjs/web';
import { createSignal, flush } from 'solid-js';
import { afterEach, expect, it } from 'vitest';
import { subscriberListHref } from '~/features/subscribers/routing';
import { Pagination } from './pagination';

const disposers: Array<() => void> = [];
afterEach(() => { for (const dispose of disposers.splice(0).reverse()) dispose(); });

it('keeps filters in links and updates navigation at page boundaries and empty results', () => {
	const container = document.createElement('div');
	const [page, setPage] = createSignal(2);
	const [total, setTotal] = createSignal(120);
	disposers.push(render(() => <Pagination label="Subscriber pages" page={page()} pageSize={50} total={total()}
		href={(next) => subscriberListHref({ page: next, search: 'Ada & Bob' })} />, container));
	flush();
	expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Subscriber pages');
	expect(container.textContent).toContain('Page 2 of 3 · 120 total');
	expect(container.querySelector('[rel="prev"]')?.getAttribute('href')).toBe(subscriberListHref({ page: 1, search: 'Ada & Bob' }));
	expect(container.querySelector('[rel="next"]')?.getAttribute('href')).toBe(subscriberListHref({ page: 3, search: 'Ada & Bob' }));
	setPage(3);
	flush();
	expect(container.querySelector('[rel="next"]')).toBeNull();
	setPage(1);
	setTotal(0);
	flush();
	expect(container.textContent).toBe('Page 1 of 1 · 0 total');
	expect(container.querySelector('a')).toBeNull();
});

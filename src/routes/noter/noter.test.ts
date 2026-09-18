import { describe, expect, it, vi } from 'vitest';
import { optionToFormFields } from '$lib/geo/merge';
import { parseBarChoice } from '$lib/validation';
import { distancePhrase, findDuplicates, manualOption } from './manual';

describe('manualOption', () => {
	it('produces hidden fields the server reads as a manual bar', () => {
		const option = manualOption('Chez Robert', null, { lat: 47.213, lon: -1.556 });
		const choice = parseBarChoice(optionToFormFields(option));
		expect(choice).toEqual({
			ok: true,
			value: { kind: 'manual', name: 'Chez Robert', address: null, lat: 47.213, lon: -1.556 }
		});
	});
});

describe('distancePhrase', () => {
	it('never claims a bar on the same spot is 10 m away', () => {
		expect(distancePhrase(0)).toBe('à moins de 10 m');
		expect(distancePhrase(32)).toBe('à 30 m');
		expect(distancePhrase(null)).toBe('tout près');
	});
});

describe('findDuplicates', () => {
	const bar = (id: number, distance: number) => ({
		id,
		name: `Bar ${id}`,
		address: null,
		lat: 47.2,
		lon: -1.5,
		source: 'manual' as const,
		sourceId: null,
		category: null,
		overall: null,
		visitCount: 1,
		distance
	});

	it('asks our API within 50 m and sorts closest first', async () => {
		const fetchMock = vi.fn(async () => Response.json({ bars: [bar(2, 40), bar(1, 5)] }));
		const found = await findDuplicates({ lat: 47.213, lon: -1.556 }, { fetch: fetchMock as typeof fetch });
		expect(found.map((b) => b.id)).toEqual([1, 2]);
		expect(String(fetchMock.mock.calls[0])).toContain('radius=50');
	});

	it('never blocks the flow when the API fails', async () => {
		const down = vi.fn(async () => new Response('nope', { status: 500 }));
		await expect(findDuplicates({ lat: 1, lon: 1 }, { fetch: down as typeof fetch })).resolves.toEqual([]);
		const offline = vi.fn(async () => Promise.reject(new TypeError('offline')));
		await expect(findDuplicates({ lat: 1, lon: 1 }, { fetch: offline as typeof fetch })).resolves.toEqual([]);
	});
});

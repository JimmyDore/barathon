import { error, redirect } from '@sveltejs/kit';
import { pseudoKey } from '$lib/pseudo';
import { getStore } from '$lib/server/db';
import { rankOf } from '../ranking';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	// « /barathoniens/Jïmmy » → « /barathoniens/jimmy » (la clé de regroupement).
	const key = pseudoKey(params.key);
	if (key !== '' && key !== params.key) redirect(308, `/barathoniens/${encodeURIComponent(key)}`);

	const store = getStore();
	const people = store.listPeople();
	const person = people.find((p) => p.key === key);
	if (!person) error(404, 'Personne sous ce nom n’a encore noté de bar.');

	return {
		person,
		rank: rankOf(people, key),
		tied: people.filter((p) => p.barCount === person.barCount && p.visitCount === person.visitCount).length > 1,
		peopleCount: people.length,
		visits: store.listVisitsByPerson(key)
	};
};

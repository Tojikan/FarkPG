import { createSupabaseServerClient } from '$lib/supabase/server';
import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

const supabaseHandle: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createSupabaseServerClient(event.cookies);

	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();
		if (!session) {
			return { session: null, user: null };
		}

		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		if (error) {
			return { session: null, user: null };
		}

		return { session, user };
	};

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};

const authGuard: Handle = async ({ event, resolve }) => {
	const { session, user } = await event.locals.safeGetSession();
	event.locals.session = session;
	event.locals.user = user;

	const path = event.url.pathname;
	const isAuthRoute = path === '/login' || path === '/signup';
	const isProtected =
		path.startsWith('/campaigns') ||
		path.startsWith('/characters') ||
		(path !== '/' && !isAuthRoute && path !== '/logout');

	if (!session && isProtected && path !== '/') {
		redirect(303, '/login');
	}

	if (session && isAuthRoute) {
		redirect(303, '/campaigns');
	}

	return resolve(event);
};

export const handle = sequence(supabaseHandle, authGuard);

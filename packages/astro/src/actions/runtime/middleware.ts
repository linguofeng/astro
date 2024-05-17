import type { APIContext, MiddlewareNext } from '../../@types/astro.js';
import { defineMiddleware } from '../../core/middleware/index.js';
import { ApiContextStorage } from './store.js';
import { formContentTypes, getAction, hasContentType } from './utils.js';
import { callSafely } from './virtual/shared.js';

export type Locals = {
	_actionsInternal: {
		getActionResult: APIContext['getActionResult'];
	};
};

export const onRequest = defineMiddleware(async (context, next) => {
	const locals = context.locals as Locals;
	// Actions middleware may have run already after a path rewrite.
	// See https://github.com/withastro/roadmap/blob/feat/reroute/proposals/0047-rerouting.md#ctxrewrite
	// `_actionsInternal` is the same for every page,
	// so short circuit if already defined.
	if (locals._actionsInternal) return next();

	const { request, url } = context;
	const contentType = request.headers.get('Content-Type');

	// Avoid double-handling with middleware when calling actions directly.
	if (url.pathname.startsWith('/_actions')) return nextWithLocalsStub(next, context);

	if (!contentType || !hasContentType(contentType, formContentTypes)) {
		return nextWithLocalsStub(next, context);
	}

	const formData = await request.clone().formData();
	const actionPath = formData.get('_astroAction');
	if (typeof actionPath !== 'string') return nextWithLocalsStub(next, context);

	const actionPathKeys = actionPath.replace('/_actions/', '').split('.');
	const action = await getAction(actionPathKeys);
	if (!action) return nextWithLocalsStub(next, context);

	const result = await ApiContextStorage.run(context, () => callSafely(() => action(formData)));

	const actionsInternal: Locals['_actionsInternal'] = {
		getActionResult: (actionFn) => {
			if (actionFn.toString() !== actionPath) return Promise.resolve(undefined);
			// The `action` uses type `unknown` since we can't infer the user's action type.
			// Cast to `any` to satisfy `getActionResult()` type.
			return result as any;
		},
	};
	Object.defineProperty(locals, '_actionsInternal', { writable: false, value: actionsInternal });
	return ApiContextStorage.run(context, () => next());
});

function nextWithLocalsStub(next: MiddlewareNext, context: APIContext) {
	Object.defineProperty(context.locals, '_actionsInternal', {
		writable: false,
		value: {
			getActionResult: () => undefined,
		},
	});
	return ApiContextStorage.run(context, () => next());
}

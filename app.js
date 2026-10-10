(function() {
	'use strict';
	const $ = id => document.getElementById(id),
		pad = n => String(n).padStart(2, '0'),
		dateKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
		parseDate = s => {
			const [y, m, d] = s.split('-').map(Number);
			return new Date(y, m - 1, d, 12)
		},
		addDays = (d, n) => {
			const x = new Date(d);
			x.setDate(x.getDate() + n);
			return x
		},
		sameDay = (a, b) => dateKey(a) === dateKey(b),
		today = new Date();
	let selected = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12),
		cursor = new Date(selected),
		view = 'all',
		modalMode = 'normal',
		toastTimer;
	const key = 'daymark-events-v1';
	let events = [],
		storageAvailable = true,
		hasStoredEvents = false;
	try {
		const stored = localStorage.getItem(key);
		hasStoredEvents = stored !== null;
		events = stored ? JSON.parse(stored) : [];
		if (!Array.isArray(events)) events = []
	} catch (_) {
		storageAvailable = false;
		events = []
	}
	if (!hasStoredEvents && storageAvailable) {
		const ds = dateKey(today);
		events = [{
			id: crypto.randomUUID(),
			title: 'Plan your week',
			date: ds,
			start: '09:00',
			end: '09:30',
			repeat: 'none',
			done: false,
			tag: 'Planning',
			description: 'A little time to get organised.'
		}, {
			id: crypto.randomUUID(),
			title: 'Take a proper lunch break',
			date: ds,
			start: '12:30',
			end: '13:15',
			repeat: 'none',
			done: false,
			tag: 'Personal'
		}, {
			id: crypto.randomUUID(),
			title: 'Check in with the team',
			date: ds,
			start: '15:00',
			end: '15:30',
			repeat: 'weekly',
			done: true,
			tag: 'Work'
		}];
		persist()
	}

	function persist() {
		try {
			localStorage.setItem(key, JSON.stringify(events));
			return true
		} catch (_) {
			storageAvailable = false;
			showToast('Browser storage is unavailable. Changes may not persist after closing this page.');
			return false
		}
	}

	function validEventTimes(start, end) {
		return !start || !end || start < end
	}

	function validEventDate(value) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
		const d = parseDate(value);
		return !Number.isNaN(d.getTime()) && dateKey(d) === value
	}

	function fmtDate(d, opts = {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	}) {
		return new Intl.DateTimeFormat('en-GB', opts).format(d)
	}

	function eventOccurs(e, d) {
		if (e.date === dateKey(d)) return true;
		if (!e.repeat || e.repeat === 'none') return false;
		const start = parseDate(e.date),
			delta = Math.round((parseDate(dateKey(d)) - start) / 86400000);
		if (delta < 0) return false;
		const interval = Math.max(1, Number(e.repeatInterval) || 1),
			unit = e.repeatUnit || ({
				daily: 'day',
				weekly: 'week',
				monthly: 'month',
				yearly: 'year'
			} [e.repeat] || 'day');
		if (unit === 'day') return delta % interval === 0;
		if (unit === 'week') return delta % (7 * interval) === 0;
		if (unit === 'month') {
			const months = (d.getFullYear() - start.getFullYear()) * 12 + d.getMonth() - start.getMonth(),
				lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
			return months >= 0 && months % interval === 0 && d.getDate() === Math.min(start.getDate(), lastDay)
		}
		if (unit === 'year') {
			const years = d.getFullYear() - start.getFullYear(),
				lastDay = new Date(d.getFullYear(), start.getMonth() + 1, 0).getDate();
			return years >= 0 && years % interval === 0 && d.getMonth() === start.getMonth() && d.getDate() === Math.min(start.getDate(), lastDay)
		}
		return false
	}

	function onDay(d) {
		return events.filter(e => eventOccurs(e, d)).sort((a, b) => (a.start || '99:99').localeCompare(b.start || '99:99'))
	}

	function timeText(e) {
		if (!e.start && !e.end) return 'All day';
		if (e.start && e.end) return e.start + ' – ' + e.end;
		if (e.start) return e.start;
		return 'Until ' + e.end
	}

	function repeatText(e) {
		if (!e || !e.repeat || e.repeat === 'none') return '';
		const unit = e.repeatUnit || ({
				daily: 'day',
				weekly: 'week',
				monthly: 'month',
				yearly: 'year'
			} [e.repeat] || 'day'),
			n = Math.max(1, Number(e.repeatInterval) || 1);
		if (n === 1 && ({
				day: 'daily',
				week: 'weekly',
				month: 'monthly',
				year: 'yearly'
			} [unit])) return 'Repeats ' + ({
			day: 'daily',
			week: 'weekly',
			month: 'monthly',
			year: 'yearly'
		} [unit]);
		return 'Repeats every ' + n + ' ' + unit + (n === 1 ? '' : 's')
	}

	function eventMarkup(e) {
		return '<article class="event ' + (e.done ? 'done' : '') + '"><input class="check" type="checkbox" aria-label="Mark ' + esc(e.title) + ' completed" data-check="' + e.id + '" ' + (e.done ? 'checked' : '') + '><div><div class="event-title">' + esc(e.title) + '</div><div class="event-meta">' + esc(timeText(e)) + (e.location ? ' · ' + esc(e.location) : '') + (repeatText(e) ? '<br>' + repeatText(e) : '') + (e.description ? '<br>' + esc(e.description) : '') + (e.people ? '<br>With ' + esc(e.people) : '') + '</div>' + (e.tag ? '<span class="tag">' + esc(e.tag) + '</span>' : '') + '</div><button class="icon-btn edit-btn" data-edit="' + e.id + '" aria-label="Edit ' + esc(e.title) + '" style="width:32px;height:32px;border:0"><svg viewBox="0 0 24 24"><path d="m14 5 5 5M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16z"/></svg></button></article>'
	}

	function esc(s) {
		return String(s || '').replace(/[&<>"']/g, c => ({
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#39;'
		} [c]))
	}

	function listMarkup(list, empty) {
		return list.length ? list.map(eventMarkup).join('') : '<div class="empty">' + empty + '</div>'
	}

	function bindEventActions(root) {
		root.querySelectorAll('[data-check]').forEach(el => el.addEventListener('change', () => {
			const e = events.find(x => x.id === el.dataset.check);
			if (e) {
				e.done = el.checked;
				persist();
				renderAll()
			}
		}));
		root.querySelectorAll('[data-edit]').forEach(el => el.addEventListener('click', () => openNormal(events.find(x => x.id === el.dataset.edit))))
	}

	function renderHome() {
		const homeDay = today;
		$('heroWeekday').textContent = fmtDate(homeDay, {
			weekday: 'long'
		});
		$('heroDate').textContent = fmtDate(homeDay, {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
		$('homeScreen').querySelector('.section-heading').textContent = sameDay(homeDay, today) ? 'Today' : fmtDate(homeDay, {
			day: 'numeric',
			month: 'long'
		}) + ' · To do';
		const list = onDay(homeDay),
			todo = list.filter(e => !e.done),
			done = list.filter(e => e.done);
		$('todayEvents').innerHTML = '<div class="eyebrow">To do · ' + todo.length + '</div><div class="event-list">' + listMarkup(todo, 'Nothing planned for this day.') + '</div><div class="eyebrow">Completed · ' + done.length + '</div><div class="event-list">' + listMarkup(done, 'Completed events will appear here.') + '</div>';
		bindEventActions($('todayEvents'))
	}

	function monthStart(d) {
		return new Date(d.getFullYear(), d.getMonth(), 1, 12)
	}

	function monthKey(d) {
		return d.getFullYear() + '-' + pad(d.getMonth() + 1)
	}

	function makeMonth(d) {
		const first = monthStart(d),
			offset = (first.getDay() + 6) % 7,
			days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(),
			count = Math.ceil((offset + days) / 7) * 7,
			start = addDays(first, -offset);
		let out = '<section class="timeline-month" data-month="' + monthKey(first) + '"><div class="timeline-title">' + esc(fmtDate(first, {
			month: 'long',
			year: 'numeric'
		})) + '</div><div class="date-grid">';
		for (let i = 0; i < count; i++) {
			const day = addDays(start, i),
				items = onDay(day);
			out += '<button class="date-cell ' + (day.getMonth() !== first.getMonth() ? 'outside ' : '') + (sameDay(day, today) ? 'today ' : '') + (sameDay(day, selected) ? 'selected' : '') + '" data-date="' + dateKey(day) + '" aria-label="' + esc(fmtDate(day)) + (items.length ? ', ' + items.length + ' events' : '') + '"><span>' + day.getDate() + '</span><span class="dots">' + items.slice(0, 3).map(() => '<i></i>').join('') + '</span></button>'
		}
		return out + '</div></section>'
	}

	function bindDateCells(root) {
		root.querySelectorAll('[data-date]:not([data-bound])').forEach(b => {
			b.dataset.bound = '1';
			b.addEventListener('click', () => {
				selected = parseDate(b.dataset.date);
				cursor = new Date(selected);
				view = 'month';
				renderCalendar();
				renderPanel();
				renderHome()
			})
		})
	}

	function renderCalendar(settleTransition = false) {
		const screen = $('calendarScreen'),
			sc = $('calendarScroller'),
			grid = $('dateGrid');
		if (settleTransition) {
			const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			const canGlide = screen.classList.contains('active') && typeof sc.animate === 'function' && !reduced;
			const beforeScroller = sc.getBoundingClientRect(),
				beforePanel = $('selectedPanel').getBoundingClientRect();
			clearTimeout(viewSettleTimer);
			screen.classList.add('is-view-settling', 'is-release-flip');
			// Keep the pointer-driven layout in place until the destination DOM exists.
			renderCalendarContent(true);
			screen.classList.remove('is-view-dragging', 'drag-toward-open', 'drag-toward-closed');
			['--drag-progress', '--drag-panel-size', '--drag-close-size', '--drag-scroller-max', '--drag-scroller-scale', '--drag-scroller-height'].forEach(k => screen.style.removeProperty(k));
			$('selectedPanel').style.removeProperty('--panel-drag-y');
			void sc.offsetWidth;
			const afterScroller = sc.getBoundingClientRect(),
				afterPanel = $('selectedPanel').getBoundingClientRect();
			const glide = (el, from, to) => {
				if (!canGlide || !from.width || !from.height || !to.width || !to.height) return;
				const dx = from.left - to.left,
					dy = from.top - to.top,
					sx = from.width / to.width,
					sy = from.height / to.height;
				if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < .015 && Math.abs(sy - 1) < .015) return;
				const anim = el.animate([{
						transformOrigin: 'top left',
						transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')'
					},
					{
						transformOrigin: 'top left',
						transform: 'translate(0,0) scale(1,1)'
					}
				], {
					duration: 520,
					easing: 'cubic-bezier(.22,.75,.25,1)',
					fill: 'both'
				});
				anim.onfinish = () => anim.cancel();
			};
			if (canGlide) {
				glide(sc, beforeScroller, afterScroller);
				glide($('selectedPanel'), beforePanel, afterPanel);
			}
			viewSettleTimer = setTimeout(() => screen.classList.remove('is-view-settling', 'is-release-flip'), canGlide ? 550 : 0);
			return;
		}
		const canAnimate = screen.classList.contains('active') && typeof sc.animate === 'function' && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
		const oldCells = new Map(),
			oldVisibleCells = [];
		if (canAnimate) {
			const clip = screen.getBoundingClientRect();
			grid.querySelectorAll('.date-cell[data-date]').forEach(el => {
				const r = el.getBoundingClientRect();
				if (!r.width || !r.height || r.bottom <= clip.top || r.top >= clip.bottom || r.right <= clip.left || r.left >= clip.right) return;
				const key = el.dataset.date,
					outside = el.classList.contains('outside');
				oldVisibleCells.push({
					key,
					rect: r,
					outside,
					node: el
				});
				const old = oldCells.get(key);
				if (!old || old.outside && !outside) oldCells.set(key, {
					rect: r,
					outside,
					node: el
				});
			});
		}
		if (canAnimate) {
			clearTimeout(viewSettleTimer);
			screen.classList.add('is-view-settling');
		}
		renderCalendarContent(true);
		if (!canAnimate) {
			screen.classList.remove('is-view-settling');
			return;
		}
		requestAnimationFrame(() => requestAnimationFrame(() => {
			const newCells = new Map(),
				clip = sc.getBoundingClientRect();
			grid.querySelectorAll('.date-cell[data-date]').forEach(el => {
				const r = el.getBoundingClientRect();
				if (!r.width || !r.height || r.bottom <= clip.top || r.top >= clip.bottom || r.right <= clip.left || r.left >= clip.right) return;
				const key = el.dataset.date,
					old = newCells.get(key),
					outside = el.classList.contains('outside');
				if (!old || old.classList.contains('outside') && !outside) newCells.set(key, el);
			});
			const duration = 460,
				easing = 'cubic-bezier(.22,.75,.25,1)';
			oldVisibleCells.forEach(entry => {
				const representative = oldCells.get(entry.key);
				if (newCells.has(entry.key) && representative?.node === entry.node) return;
				const clone = entry.node.cloneNode(true);
				clone.setAttribute('aria-hidden', 'true');
				clone.removeAttribute('data-bound');
				clone.disabled = true;
				clone.style.cssText += ';position:fixed;left:' + entry.rect.left + 'px;top:' + entry.rect.top + 'px;width:' + entry.rect.width + 'px;height:' + entry.rect.height + 'px;margin:0;z-index:9999;pointer-events:none;transform-origin:center';
				document.body.appendChild(clone);
				const fade = clone.animate([{
					opacity: 1,
					transform: 'scale(1)'
				}, {
					opacity: 0,
					transform: 'scale(.86)'
				}], {
					duration: 260,
					easing: 'ease-out',
					fill: 'forwards'
				});
				fade.onfinish = () => clone.remove();
			});
			newCells.forEach((el, key) => {
				const from = oldCells.get(key)?.rect,
					to = el.getBoundingClientRect();
				if (from && to.width && to.height) {
					const dx = from.left - to.left,
						dy = from.top - to.top,
						sx = from.width / to.width,
						sy = from.height / to.height;
					if (Math.abs(dx) > 1 || Math.abs(dy) > 1 || Math.abs(sx - 1) > .015 || Math.abs(sy - 1) > .015) {
						el.animate([{
							transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')',
							opacity: .84
						}, {
							transform: 'translate(0,0) scale(1,1)',
							opacity: 1
						}], {
							duration,
							easing,
							fill: 'both'
						});
					}
				} else {
					el.animate([{
						opacity: 0,
						transform: 'scale(.88)'
					}, {
						opacity: 1,
						transform: 'scale(1)'
					}], {
						duration: 300,
						easing,
						fill: 'both'
					});
				}
			});
			viewSettleTimer = setTimeout(() => screen.classList.remove('is-view-settling'), 520);
		}));
	}

	function renderCalendarContent(settleTransition = false) {
		const screen = $('calendarScreen');
		if (!settleTransition) screen.classList.remove('is-view-settling');
		screen.classList.toggle('panel-open', view !== 'all');
		$('monthTitle').textContent = fmtDate(cursor, {
			month: 'long',
			year: 'numeric'
		});
		const sc = $('calendarScroller'),
			grid = $('dateGrid');
		sc.className = 'calendar-scroller ' + (view === 'week' ? 'week-mode' : view === 'month' ? 'month-mode' : 'all-mode');
		sc.classList.remove('view-enter');
		void sc.offsetWidth;
		sc.classList.add('view-enter');
		if (view === 'all') {
			grid.style.display = 'block';
			grid.innerHTML = '';
			const start = new Date(cursor.getFullYear(), cursor.getMonth() - 6, 1, 12);
			for (let i = 0; i < 13; i++) grid.insertAdjacentHTML('beforeend', makeMonth(new Date(start.getFullYear(), start.getMonth() + i, 1, 12)));
			bindDateCells(grid);
			requestAnimationFrame(() => {
				const target = grid.querySelector('[data-month="' + monthKey(cursor) + '"]');
				if (target) {
					const sr = sc.getBoundingClientRect(),
						tr = target.getBoundingClientRect();
					sc.scrollTop += tr.top - sr.top - 28;
				}
			});
		} else {
			grid.style.display = 'grid';
			const first = monthStart(cursor);
			let start;
			if (view === 'week') {
				start = new Date(selected);
				start = addDays(start, -((start.getDay() + 6) % 7))
			} else start = addDays(first, -((first.getDay() + 6) % 7));
			const count = view === 'week' ? 7 : 42;
			let out = '';
			for (let i = 0; i < count; i++) {
				const d = addDays(start, i),
					inside = d.getMonth() === cursor.getMonth(),
					items = onDay(d);
				out += '<button class="date-cell ' + (!inside && view !== 'week' ? 'outside ' : '') + (sameDay(d, today) ? 'today ' : '') + (sameDay(d, selected) ? 'selected' : '') + '" data-date="' + dateKey(d) + '" aria-label="' + esc(fmtDate(d)) + (items.length ? ', ' + items.length + ' events' : '') + '"><span>' + d.getDate() + '</span><span class="dots">' + items.slice(0, 3).map(() => '<i></i>').join('') + '</span></button>'
			}
			grid.innerHTML = out;
			bindDateCells(grid)
		}
		renderPanel()
	}

	function renderPanel() {
		$('panelDate').textContent = fmtDate(selected, {
			weekday: 'long',
			day: 'numeric',
			month: 'long'
		});
		const list = onDay(selected);
		$('panelEvents').innerHTML = '<div class="event-list">' + listMarkup(list, 'No events planned for this day.') + '</div>';
		bindEventActions($('panelEvents'))
	}

	function renderAll() {
		renderHome();
		renderCalendar()
	}

	function switchScreen(name) {
		document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === name + 'Screen'));
		document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.screen === name));
		if (name === 'calendar') renderCalendar()
	}
	document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => switchScreen(b.dataset.screen)));

	function showToast(msg) {
		const t = $('toast');
		t.textContent = msg;
		t.classList.add('show');
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => t.classList.remove('show'), 2600)
	}

	function openModal(mode) {
		modalMode = mode;
		$('modalBackdrop').dataset.mode = mode;
		$('modalTitle').textContent = mode === 'quick' ? 'Quick add' : 'New event';
		$('quickForm').hidden = mode !== 'quick';
		$('eventForm').hidden = mode === 'quick';
		$('modalBackdrop').classList.add('open');
		if (mode === 'quick') {
			$('quickText').value = '';
			$('quickPreview').textContent = '';
			setTimeout(() => $('quickText').focus(), 100)
		} else if (!$('eventTitle').value) setNormalDefaults()
	}

	function closeModal() {
		$('modalBackdrop').classList.remove('open')
	}

	function setNormalDefaults(e) {
		$('eventTitle').value = e?.title || '';
		$('eventDescription').value = e?.description || '';
		$('eventDate').value = e?.date || dateKey(selected);
		$('eventLocation').value = e?.location || '';
		$('eventStart').value = e?.start || '';
		$('eventEnd').value = e?.end || '';
		$('eventRepeat').value = e?.repeat || 'none';
		$('eventPeople').value = e?.people || '';
		$('eventNotes').value = e?.notes || '';
		$('eventForm').dataset.editId = e?.id || ''
	}

	function openNormal(e) {
		switchScreen('calendar');
		openModal('normal');
		setNormalDefaults(e);
		$('modalTitle').textContent = e ? 'Edit event' : 'New event';
		if (e) {
			const old = $('eventForm').querySelector('.delete-event');
			if (old) old.remove();
			const del = document.createElement('button');
			del.type = 'button';
			del.className = 'secondary delete-event';
			del.innerHTML = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/></svg>';
			del.setAttribute('aria-label', 'Delete event');
			del.title = 'Delete event';
			del.style.cssText = 'width:48px;height:44px;display:grid;place-items:center;margin:10px 0 0 auto;padding:0';
			del.onclick = () => {
				if (confirm('Delete this event?')) {
					events = events.filter(x => x.id !== e.id);
					persist();
					closeModal();


					renderAll();
					showToast('Event deleted')
				}
			};
			$('eventForm').appendChild(del)
		} else {
			$('eventForm').querySelector('.delete-event')?.remove()
		}
	}
	$('panelQuick').addEventListener('click', () => openModal('quick'));
	$('panelAdd').addEventListener('click', () => openNormal());
	$('closeModal').addEventListener('click', closeModal);
	$('modalBackdrop').addEventListener('click', e => {
		if (e.target === $('modalBackdrop')) closeModal()
	});

	function parseNatural(raw) {
		let s = raw.trim(),
			title = s,
			date = new Date(selected),
			start = '',
			end = '',
			repeat = 'none',
			repeatInterval = 1,
			repeatUnit = '',
			explicitDate = false;
		const now = new Date();

		function setDate(d) {
			date = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
			explicitDate = true
		}
		let m;
		if ((m = s.match(/\b(today|tomorrow|day after tomorrow)\b/i))) {
			setDate(addDays(now, /day after tomorrow/i.test(m[0]) ? 2 : /tomorrow/i.test(m[0]) ? 1 : 0));
			title = title.replace(m[0], ' ')
		}
		if ((m = s.match(/\b(on\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(\d{4}))?\b/i))) {
			const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
				mo = months.indexOf(m[3].slice(0, 3).toLowerCase()),
				yr = Number(m[4] || now.getFullYear());
			setDate(new Date(yr, mo, Number(m[2]), 12));
			if (!m[4] && date < new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12)) date.setFullYear(date.getFullYear() + 1);
			title = title.replace(m[0], ' ')
		}

		function norm(t, other) {
			let z = t.toLowerCase().replace(/\s/g, '');
			const ap = z.match(/(am|pm)$/);
			z = z.replace(/(am|pm)$/, '');
			const p = z.split(':'),
				h0 = Number(p[0]),
				min = Number(p[1] || 0);
			let h = h0;
			if (ap) {
				if (ap[1] === 'pm' && h < 12) h += 12;
				if (ap[1] === 'am' && h === 12) h = 0
			} else if (other) {
				const oa = other.toLowerCase().replace(/\s/g, '').match(/(am|pm)$/);
				if (oa) {
					if (oa[1] === 'pm' && h < 12) h += 12;
					if (oa[1] === 'am' && h === 12) h = 0
				}
			}
			if (h > 23 || min > 59) return '';
			return pad(h) + ':' + pad(min)
		}
		const timePattern = '(?:[01]?\\d|2[0-3]):[0-5]\\d';
		const rangeRe = new RegExp('(' + timePattern + ')\\\\s*(?:to|until|[-–])\\\\s*(' + timePattern + ')', 'i');
		let tm = rangeRe.exec(s);
		if (!tm) tm = /(\b(?:[01]?\d|2[0-3]):[0-5]\d)\s*(?:to|until|[-–])\s*(\b(?:[01]?\d|2[0-3]):[0-5]\d)\b/i.exec(s);
		if (tm) {
			start = norm(tm[1], tm[2]);
			end = norm(tm[2], tm[1]);
			title = title.replace(tm[0], ' ')
		} else if ((m = s.match(/\b(?:at\s*)?((?:[01]?\d|2[0-3]):[0-5]\d)\b/i))) {
			start = norm(m[1]);
			title = title.replace(m[0], ' ')
		} else if ((m = s.match(/\b(?:at\s*)?(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/i))) {
			let h = Number(m[1]),
				min = Number(m[2] || 0);
			if (m[3].toLowerCase() === 'pm' && h < 12) h += 12;
			if (m[3].toLowerCase() === 'am' && h === 12) h = 0;
			start = pad(h) + ':' + pad(min);
			title = title.replace(m[0], ' ')
		} else if (/\bnoon\b/i.test(s)) {
			start = '12:00';
			title = title.replace(/\bnoon\b/i, ' ')
		} else if (/\bmidnight\b/i.test(s)) {
			start = '00:00';
			title = title.replace(/\bmidnight\b/i, ' ')
		}
		let rec = null;
		const combo = /\bevery\s+(\d+)\s*weeks?\s+and\s+(\d+)\s*days?\b/i.exec(s);
		if (combo) {
			repeat = 'daily';
			repeatUnit = 'day';
			repeatInterval = Math.max(1, Number(combo[1]) * 7 + Number(combo[2]));
			rec = combo[0]
		} else if ((m = /\bevery\s+(\d+)\s*days?\b/i.exec(s))) {
			repeat = 'daily';
			repeatUnit = 'day';
			repeatInterval = Math.max(1, Number(m[1]));
			rec = m[0]
		} else if ((m = /\bevery\s+(\d+)\s*weeks?\b/i.exec(s))) {
			repeat = 'weekly';
			repeatUnit = 'week';
			repeatInterval = Math.max(1, Number(m[1]));
			rec = m[0]
		} else if ((m = /\bevery\s+(\d+)\s*months?\b/i.exec(s))) {
			repeat = 'monthly';
			repeatUnit = 'month';
			repeatInterval = Math.max(1, Number(m[1]));
			rec = m[0]
		} else if ((m = /\bevery\s+(\d+)\s*years?\b/i.exec(s))) {
			repeat = 'yearly';
			repeatUnit = 'year';
			repeatInterval = Math.max(1, Number(m[1]));
			rec = m[0]
		} else if ((m = /\bevery\s+day\b|\bdaily\b/i.exec(s))) {
			repeat = 'daily';
			repeatUnit = 'day';
			repeatInterval = 1;
			rec = m[0]
		} else if ((m = /\bevery\s+week\b|\bweekly\b|\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.exec(s))) {
			repeat = 'weekly';
			repeatUnit = 'week';
			repeatInterval = 1;
			rec = m[0]
		} else if ((m = /\bevery\s+month\b|\bmonthly\b/i.exec(s))) {
			repeat = 'monthly';
			repeatUnit = 'month';
			repeatInterval = 1;
			rec = m[0]
		} else if ((m = /\bevery\s+year\b|\byearly\b|\bannually\b/i.exec(s))) {
			repeat = 'yearly';
			repeatUnit = 'year';
			repeatInterval = 1;
			rec = m[0]
		}
		if (rec) title = title.replace(rec, ' ');
		title = title.replace(/\b(on|at)\b/gi, ' ').replace(/[,.]+/g, ' ').replace(/\s+/g, ' ').trim();
		if (!title) title = raw.trim();
		return {
			title,
			date: dateKey(date),
			start,
			end,
			repeat,
			repeatInterval,
			repeatUnit,
			tag: repeat !== 'none' ? 'Repeating' : start ? 'Timed' : 'All day'
		}
	}
	let quickParseTimer = null;

	function showQuickPreview(p, prefix = 'Preview') {
		$('quickPreview').textContent = prefix + ': ' + p.title + ' · ' + fmtDate(parseDate(p.date), {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		}) + ' · ' + (p.start ? (p.start + (p.end ? '–' + p.end : '')) : 'All day') + (p.repeat !== 'none' ? ' · ' + repeatText(p.repeat) : '') + (p.description ? ' · ' + p.description : '') + (p.location ? ' · ' + p.location : '');
	}
	$('quickText').addEventListener('input', () => {
		const raw = $('quickText').value.trim();
		clearTimeout(quickParseTimer);
		if (!raw) {
			$('quickPreview').textContent = '';
			return
		}
		showQuickPreview(parseNatural(raw), 'Rule-based preview');
	});
	$('quickSave').addEventListener('click', () => {
		const raw = $('quickText').value.trim();
		if (!raw) {
			showToast('Describe your event first.');
			return
		}
		const p = parseNatural(raw);
		if (!p.title || !validEventDate(p.date)) {
			showToast('Add a valid event name and date.');
			return
		}
		if (!validEventTimes(p.start, p.end)) {
			showToast('End time must be later than start time.');
			return
		}
		events.push({
			id: crypto.randomUUID(),
			...p,
			done: false,
			description: '',
			location: '',
			people: '',
			notes: ''
		});
		persist();
		selected = parseDate(p.date);
		cursor = new Date(selected);
		view = 'month';
		closeModal();
		renderAll();
		switchScreen('calendar');
		showToast('Event added');
	});
	$('eventForm').addEventListener('submit', e => {
		e.preventDefault();
		const id = $('eventForm').dataset.editId;
		const old = events.find(x => x.id === id);
		const item = {
			id: id || crypto.randomUUID(),
			title: $('eventTitle').value.trim(),
			description: $('eventDescription').value.trim(),
			date: $('eventDate').value,
			start: $('eventStart').value,
			end: $('eventEnd').value,
			repeat: $('eventRepeat').value,
			location: $('eventLocation').value.trim(),
			people: $('eventPeople').value.trim(),
			notes: $('eventNotes').value.trim(),
			done: old?.done || false,
			tag: $('eventRepeat').value !== 'none' ? 'Repeating' : $('eventStart').value ? 'Timed' : ''
		};
		if (!item.title) {
			showToast('Add an event title.');
			$('eventTitle').focus();
			return
		}
		if (!validEventDate(item.date)) {
			showToast('Choose a valid event date.');
			$('eventDate').focus();
			return
		}
		if (!validEventTimes(item.start, item.end)) {
			showToast('End time must be later than start time.');
			$('eventEnd').focus();
			return
		}
		if (id) events = events.map(x => x.id === id ? item : x);
		else events.push(item);
		selected = parseDate(item.date);
		cursor = new Date(selected);
		view = 'month';
		persist();
		closeModal();
		renderAll();
		showToast(id ? 'Event updated' : 'Event added');
		$('eventForm').dataset.editId = ''
	});
	['prevYear', 'nextYear', 'prevMonth', 'nextMonth'].forEach(id => $(id).addEventListener('click', () => {
		const amount = id === 'prevYear' ? -12 : id === 'nextYear' ? 12 : id === 'prevMonth' ? -1 : 1;
		cursor = new Date(cursor.getFullYear(), cursor.getMonth() + amount, 1, 12);
		selected = new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(selected.getDate(), new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()), 12);
		renderCalendar()
	}));

	$('searchInput').addEventListener('input', () => {
		const raw = $('searchInput').value.trim(),
			q = raw.toLowerCase(),
			root = $('searchResults');
		root.innerHTML = '';
		if (!q) return;
		const parsed = new Date(raw),
			exactDate = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? parseDate(raw) : (!Number.isNaN(parsed.getTime()) && raw.length > 5 ? new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12) : null);
		const dateSet = new Map();
		events.forEach(e => {
			const d = parseDate(e.date),
				label = fmtDate(d, {
					month: 'long',
					day: 'numeric',
					year: 'numeric'
				});
			if (label.toLowerCase().includes(q) || e.date.includes(q)) dateSet.set(e.date, d)
		});
		if (exactDate) dateSet.set(dateKey(exactDate), exactDate);
		if (dateSet.size) {
			const heading = document.createElement('div');
			heading.className = 'search-section-label';
			heading.textContent = 'Dates';
			root.appendChild(heading);
			const dates = document.createElement('div');
			dates.className = 'date-suggestions';
			Array.from(dateSet.values()).sort((a, b) => a - b).slice(0, 8).forEach(d => {
				const b = document.createElement('button');
				b.type = 'button';
				b.className = 'date-suggestion';
				b.innerHTML = '<span>' + esc(fmtDate(d, {
					month: 'long',
					day: 'numeric',
					year: 'numeric'
				})) + '</span><span class="suggestion-weekday">' + esc(fmtDate(d, {
					weekday: 'long'
				})) + '</span>';
				b.addEventListener('click', () => {
					selected = new Date(d);
					cursor = new Date(d);
					view = 'month';
					$('searchInput').value = '';
					root.innerHTML = '';
					renderCalendar();
					renderHome()
				});
				dates.appendChild(b)
			});
			root.appendChild(dates)
		}
		const matches = events.filter(e => (e.title + ' ' + e.description + ' ' + e.location + ' ' + e.date + ' ' + fmtDate(parseDate(e.date), {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		})).toLowerCase().includes(q)).sort((a, b) => a.date.localeCompare(b.date) || (a.start || '99:99').localeCompare(b.start || '99:99')).slice(0, 20);
		if (matches.length) {
			const h = document.createElement('div');
			h.className = 'search-section-label';
			h.textContent = 'Events · chronological';
			root.appendChild(h);
			const list = document.createElement('div');
			list.className = 'search-event-list';
			list.innerHTML = matches.map(e => '<div class="search-event-date">' + esc(fmtDate(parseDate(e.date), {
				weekday: 'short',
				day: 'numeric',
				month: 'short',
				year: 'numeric'
			})) + '</div>' + eventMarkup(e)).join('');
			root.appendChild(list);
			bindEventActions(list)
		} else if (!dateSet.size) {
			const empty = document.createElement('div');
			empty.className = 'empty';
			empty.textContent = 'No matching events or dates.';
			root.appendChild(empty)
		}
	});
	let handleY = 0,
		handleX = 0,
		handleLastY = 0,
		handleStartView = 'all',
		handleStartScrollerHeight = 0,
		handleDragging = false,
		handlePreviewView = null;
	const handle = $('selectedPanel').querySelector('.handle-grip'),
		selectedPanel = $('selectedPanel'),
		calendarScreen = $('calendarScreen');

	function clearHandleDrag(keepLayoutPreview = false) {
		handleDragging = false;
		handlePreviewView = null;
		handle.classList.remove('dragging');
		selectedPanel.classList.remove('is-dragging');
		if (keepLayoutPreview) return;
		calendarScreen.classList.remove('is-view-dragging', 'drag-toward-open', 'drag-toward-closed');
		['--drag-progress', '--drag-panel-size', '--drag-close-size', '--drag-scroller-max', '--drag-scroller-scale', '--drag-scroller-height'].forEach(k => calendarScreen.style.removeProperty(k));
		selectedPanel.style.removeProperty('--panel-drag-y')
	}

	function nextDragView(startView, dy) {
		if (dy < 0) return startView === 'all' ? 'month' : startView === 'month' ? 'week' : 'week';
		return startView === 'week' ? 'month' : startView === 'month' ? 'all' : 'all'
	}

	function handleDragCanChange(startView, dy) {
		return (startView === 'all' && dy < 0) || (startView === 'month' && dy !== 0) || (startView === 'week' && dy > 0)
	}

	function updateDragPreview(dy) {
		const canPreview = handleDragCanChange(handleStartView, dy);
		const distance = Math.max(140, Math.min(220, window.innerHeight * .28));
		const progress = canPreview ? Math.min(1, Math.abs(dy) / distance) : 0;
		calendarScreen.style.setProperty('--drag-progress', String(progress));
		calendarScreen.style.setProperty('--drag-panel-size', Math.max(0, Math.min(-dy, Math.min(window.innerHeight * .55, 420))) + 'px');
		calendarScreen.style.setProperty('--drag-close-size', Math.max(0, Math.min(Math.abs(dy), Math.min(window.innerHeight * .55, 420))) + 'px');
		const previewTarget = canPreview && progress >= .42 ? nextDragView(handleStartView, dy) : handleStartView;
		if (handleStartView !== 'all') {
			const maxHeight = Math.max(150, calendarScreen.clientHeight - (calendarScreen.querySelector('.search-wrap')?.offsetHeight || 0) - 80);
			const base = Math.min(maxHeight, Math.max(78, handleStartScrollerHeight));
			const targetHeight = Math.max(78, Math.min(maxHeight, base + dy));
			calendarScreen.style.setProperty('--drag-scroller-height', targetHeight + 'px');
		}
		calendarScreen.classList.toggle('drag-toward-open', canPreview && dy < 0);
		calendarScreen.classList.toggle('drag-toward-closed', canPreview && dy > 0);
		// Preview only the layout while dragging. Re-rendering here replaces the grid
		// and resets panel-open, which causes the drag to snap instead of following
		// the pointer. The actual view is committed once, on pointerup.
		handlePreviewView = previewTarget;
	}
	handle.addEventListener('pointerdown', e => {
		if (e.button !== undefined && e.button !== 0) return;
		handleY = e.clientY;
		handleX = e.clientX;
		handleLastY = e.clientY;
		handleStartView = view;
		handlePreviewView = view;
		handleStartScrollerHeight = $('calendarScroller').getBoundingClientRect().height;
		handleDragging = true;
		selectedPanel.classList.add('is-dragging');
		calendarScreen.classList.add('is-view-dragging');
		handle.classList.add('dragging');
		calendarScreen.style.setProperty('--drag-progress', '0');
		selectedPanel.style.setProperty('--panel-drag-y', '0px');
		if (handleStartView !== 'all') calendarScreen.style.setProperty('--drag-scroller-height', handleStartScrollerHeight + 'px');
		handle.setPointerCapture?.(e.pointerId);
	});
	handle.addEventListener('pointermove', e => {
		if (!handleDragging) return;
		handleLastY = e.clientY;
		const dy = Math.max(-Math.min(window.innerHeight * .55, 420), Math.min(window.innerHeight * .45, handleLastY - handleY));
		updateDragPreview(dy);
	});

	function settleHandleDrag(target) {
		if (!handleDragging) return;
		// Keep the pointer-driven geometry for both outcomes: commit the new view if
		// the drag crossed its threshold, or glide back to the current view otherwise.
		// In either case, renderCalendar captures the release position and eases the
		// calendar and panel into their final geometry without opacity effects.
		clearTimeout(viewSettleTimer);
		clearHandleDrag(true);
		view = target;
		renderCalendar(true);
	}

	function finishHandleDrag(e) {
		if (!handleDragging) return;
		const dy = (e.clientY ?? handleLastY) - handleY,
			dx = (e.clientX ?? handleX) - handleX;
		const threshold = Math.max(55, window.innerHeight * .075);
		const valid = Math.abs(dy) >= threshold && Math.abs(dy) >= Math.abs(dx) * 1.15 && handleDragCanChange(handleStartView, dy);
		settleHandleDrag(valid ? nextDragView(handleStartView, dy) : handleStartView);
	}
	handle.addEventListener('pointerup', finishHandleDrag);
	handle.addEventListener('pointercancel', () => {
		if (handleDragging) settleHandleDrag(handleStartView)
	});
	handle.addEventListener('lostpointercapture', () => {
		if (handleDragging) settleHandleDrag(handleStartView)
	});
	let timelineBusy = false,
		viewWheelLock = false,
		viewSettleTimer = null;
	$('calendarScroller').addEventListener('scroll', () => {
		if (view !== 'all' || timelineBusy) return;
		const sc = $('calendarScroller'),
			grid = $('dateGrid'),
			sections = grid.querySelectorAll('.timeline-month');
		if (!sections.length) return;
		const scRect = sc.getBoundingClientRect();
		let nearest = sections[0];
		for (const sec of sections) {
			if (sec.getBoundingClientRect().top <= scRect.top + 35) nearest = sec;
			else break
		}
		const shown = nearest.dataset.month.split('-').map(Number);
		cursor = new Date(shown[0], shown[1] - 1, 1, 12);
		$('monthTitle').textContent = fmtDate(cursor, {
			month: 'long',
			year: 'numeric'
		});
		if (sc.scrollTop < 220) {
			timelineBusy = true;
			const first = sections[0],
				parts = first.dataset.month.split('-').map(Number),
				newMonth = new Date(parts[0], parts[1] - 12, 1, 12),
				oldHeight = sc.scrollHeight;
			grid.insertAdjacentHTML('afterbegin', Array.from({
				length: 12
			}, (_, i) => makeMonth(new Date(newMonth.getFullYear(), newMonth.getMonth() + i, 1, 12))).join(''));
			bindDateCells(grid);
			sc.scrollTop += sc.scrollHeight - oldHeight;
			requestAnimationFrame(() => {
				timelineBusy = false
			})
		} else if (sc.scrollHeight - sc.scrollTop - sc.clientHeight < 260) {
			timelineBusy = true;
			const last = sections[sections.length - 1],
				parts = last.dataset.month.split('-').map(Number),
				newMonth = new Date(parts[0], parts[1], 1, 12);
			grid.insertAdjacentHTML('beforeend', Array.from({
				length: 12
			}, (_, i) => makeMonth(new Date(newMonth.getFullYear(), newMonth.getMonth() + i, 1, 12))).join(''));
			bindDateCells(grid);
			requestAnimationFrame(() => {
				timelineBusy = false
			})
		}
	}, {
		passive: true
	});
	const calendarScroller = $('calendarScroller');
	calendarScroller.addEventListener('wheel', e => {
		if (Math.abs(e.deltaY) < 18 || view === 'all' || viewWheelLock || $('searchInput').value.trim()) return;
		if (Math.abs(e.deltaY) < Math.abs(e.deltaX) * 1.15) return;
		e.preventDefault();
		viewWheelLock = true;
		const direction = e.deltaY > 0 ? 1 : -1;
		const next = view === 'month' ? (direction > 0 ? 'all' : 'week') : (direction > 0 ? 'month' : 'week');
		if (next !== view) {
			view = next;
			renderCalendar()
		}
		setTimeout(() => {
			viewWheelLock = false
		}, 520)
	}, {
		passive: false
	});
	let touchX = 0,
		touchY = 0;
	$('calendarScreen').addEventListener('touchstart', e => {
		touchX = e.touches[0].clientX;
		touchY = e.touches[0].clientY
	}, {
		passive: true
	});
	$('calendarScreen').addEventListener('touchend', e => {
		const dx = e.changedTouches[0].clientX - touchX,
			dy = e.changedTouches[0].clientY - touchY;
		if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.25 && view !== 'all') {
			cursor = new Date(cursor.getFullYear(), cursor.getMonth() + (dx < 0 ? 1 : -1), 1, 12);
			selected = new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(selected.getDate(), new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()), 12);
			renderCalendar()
		}
	}, {
		passive: true
	});

	document.addEventListener('keydown', e => {
		if (e.key === 'Escape') closeModal()
	});
	/* Local profile, time-zone preference, appearance, and calendar export */
	const settingsKey = 'daymark-settings-v1';
	const deviceTimezone = () => {
		try {
			return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
		} catch (_) {
			return 'UTC'
		}
	};
	const defaultSettings = {
		name: '',
		location: '',
		timezoneMode: 'auto',
		timezone: deviceTimezone(),
		dark: false
	};
	let appSettings = {
		...defaultSettings
	};
	try {
		const saved = JSON.parse(localStorage.getItem(settingsKey) || '{}');
		if (saved && typeof saved === 'object') appSettings = {
			...defaultSettings,
			...saved
		}
	} catch (_) {}

	function saveAppSettings() {
		try {
			localStorage.setItem(settingsKey, JSON.stringify(appSettings));
			return true
		} catch (_) {
			showToast('Could not save settings in this browser.');
			return false
		}
	}

	function timezoneNames() {
		try {
			if (typeof Intl.supportedValuesOf === 'function') return Intl.supportedValuesOf('timeZone')
		} catch (_) {}
		return ['UTC', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome', 'Europe/Amsterdam', 'Europe/Dublin', 'Europe/Helsinki', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto', 'America/Vancouver', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Seoul', 'Australia/Perth', 'Australia/Sydney', 'Pacific/Auckland']
	}
	let allTimezones = timezoneNames();

	function renderProfile() {
		const name = appSettings.name.trim() || 'Your name',
			location = appSettings.location.trim() || 'Add your location';
		$('profileName').textContent = name;
		$('profileLocation').textContent = location;
		$('profileAvatar').textContent = appSettings.name.trim() ? appSettings.name.trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase() : 'A';
		$('settingsName').value = appSettings.name;
		$('settingsLocation').value = appSettings.location
	}

	function currentTimezone() {
		return appSettings.timezoneMode === 'manual' && allTimezones.includes(appSettings.timezone) ? appSettings.timezone : deviceTimezone()
	}

	function renderTimezone() {
		const tz = currentTimezone();
		$('timezoneSummary').textContent = appSettings.timezoneMode === 'auto' ? 'Automatic · ' + deviceTimezone() : tz;
		$('timezoneAuto').setAttribute('aria-pressed', String(appSettings.timezoneMode === 'auto'));
		$('timezoneManual').setAttribute('aria-pressed', String(appSettings.timezoneMode === 'manual'));
		$('timezoneSearchWrap').hidden = appSettings.timezoneMode !== 'manual';
		$('timezoneHelp').textContent = appSettings.timezoneMode === 'auto' ? 'Follows the time zone configured on this device.' : 'Selected: ' + tz + '. Existing event dates and times are not converted.';
		populateTimezoneOptions($('timezoneSearch').value || '')
	}

	function populateTimezoneOptions(query = '') {
		const root = $('timezoneResults'),
			q = query.trim().toLowerCase();
		const filtered = allTimezones.filter(z => z.toLowerCase().replace(/_/g, ' ').includes(q)).sort((a, b) => {
			const ap = a === appSettings.timezone ? -1 : 0,
				bp = b === appSettings.timezone ? -1 : 0;
			return ap - bp || a.localeCompare(b)
		}).slice(0, 80);
		root.innerHTML = '';
		if (!filtered.length) {
			root.innerHTML = '<p class="timezone-no-results">No matching time zones. Try a city or region name.</p>';
			return
		}
		filtered.forEach(z => {
			const b = document.createElement('button');
			b.type = 'button';
			b.className = 'timezone-result' + (z === appSettings.timezone ? ' selected' : '');
			b.setAttribute('role', 'option');
			b.setAttribute('aria-selected', String(z === appSettings.timezone));
			const name = z.split('/').pop().replace(/_/g, ' '),
				region = z.includes('/') ? z.slice(0, z.lastIndexOf('/')).replace(/_/g, ' ') : 'Global';
			b.innerHTML = '<span class="timezone-result-name">' + esc(name) + '</span><span class="timezone-result-region">' + esc(region) + '</span>';
			b.addEventListener('click', () => {
				appSettings.timezone = z;
				populateTimezoneOptions($('timezoneSearch').value);
				$('timezoneHelp').textContent = 'Selected: ' + z + '. Save to apply this preference.'
			});
			root.appendChild(b)
		})
	}

	function openSettingsDetail(which) {
		const ids = {
			timezone: 'timezoneDetail',
			account: 'accountDetail'
		};
		Object.entries(ids).forEach(([key, id]) => {
			const open = key === which && $(id).hidden;
			$(id).hidden = !open;
			$(key === 'timezone' ? 'timezoneToggle' : 'accountToggle').setAttribute('aria-expanded', String(open))
		});
		if (which === 'timezone' && !$('timezoneDetail').hidden) {
			renderTimezone();
			$('timezoneMode').focus()
		}
	}
	$('profileEdit').addEventListener('click', () => {
		openSettingsDetail('account');
		$('settingsName').focus()
	});
	$('timezoneToggle').addEventListener('click', () => openSettingsDetail('timezone'));
	$('accountToggle').addEventListener('click', () => openSettingsDetail('account'));
	$('timezoneAuto').addEventListener('click', () => {
		appSettings.timezoneMode = 'auto';
		appSettings.timezone = deviceTimezone();
		renderTimezone()
	});
	$('timezoneManual').addEventListener('click', () => {
		appSettings.timezoneMode = 'manual';
		renderTimezone();
		$('timezoneSearch').focus()
	});
	$('timezoneSearch').addEventListener('input', () => populateTimezoneOptions($('timezoneSearch').value));
	$('saveTimezone').addEventListener('click', () => {
		if (appSettings.timezoneMode === 'manual' && !allTimezones.includes(appSettings.timezone)) {
			showToast('Choose a time zone from the search results.');
			return
		}
		if (appSettings.timezoneMode === 'auto') appSettings.timezone = deviceTimezone();
		if (saveAppSettings()) {
			renderTimezone();
			showToast('Time zone preference saved')
		}
	})
	$('saveProfile').addEventListener('click', () => {
		appSettings.name = $('settingsName').value.trim();
		appSettings.location = $('settingsLocation').value.trim();
		if (saveAppSettings()) {
			renderProfile();
			showToast('Profile saved')
		}
	})

	function applyAppearance() {
		document.querySelector('.app').classList.toggle('settings-dark', !!appSettings.dark);
		$('appearanceToggle').setAttribute('aria-checked', String(!!appSettings.dark))
	}
	$('appearanceToggle').addEventListener('click', () => {
		appSettings.dark = !appSettings.dark;
		if (saveAppSettings()) applyAppearance()
	});
	$('exportCalendar').addEventListener('click', () => {
		const escapeIcs = v => String(v || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
		const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Daymark//SimpleCalendar//EN', 'CALSCALE:GREGORIAN'];
		events.forEach(e => {
			if (!validEventDate(e.date)) return;
			const stamp = e.date.replace(/-/g, '');
			lines.push('BEGIN:VEVENT', 'UID:' + escapeIcs(e.id || crypto.randomUUID()) + '@daymark', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''), (e.start ? 'DTSTART:' + stamp + 'T' + e.start.replace(':', '') + '00' : 'DTSTART;VALUE=DATE:' + stamp));
			if (e.end && e.start) lines.push('DTEND:' + stamp + 'T' + e.end.replace(':', '') + '00');
			lines.push('SUMMARY:' + escapeIcs(e.title));
			if (e.description) lines.push('DESCRIPTION:' + escapeIcs(e.description));
			if (e.location) lines.push('LOCATION:' + escapeIcs(e.location));
			lines.push('END:VEVENT')
		});
		lines.push('END:VCALENDAR');
		const blob = new Blob([lines.join('\r\n') + '\r\n'], {
				type: 'text/calendar;charset=utf-8'
			}),
			url = URL.createObjectURL(blob),
			a = document.createElement('a');
		a.href = url;
		a.download = 'daymark-calendar.ics';
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
		showToast('Calendar export prepared')
	});
	if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
		window.addEventListener('load', () => {
			navigator.serviceWorker.register('./sw.js').catch(() => {
				// The app remains usable when service-worker registration is unavailable.
			});
		}, {
			once: true
		});
	}

	renderProfile();
	renderTimezone();
	applyAppearance();
	renderAll();
})();

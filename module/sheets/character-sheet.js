/**
 * DH2eCharacterSheet — основной класс листа персонажа.
 * RU: Формирует данные для шаблона, вешает слушатели, выполняет броски и диалоги.
 * EN: Builds template data, binds listeners, performs rolls and opens dialogs.
 */
globalThis.DH2eCharacterSheet = class DH2eCharacterSheet extends ActorSheet {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ['dh2e', 'sheet', 'actor', 'character'],
			template: 'systems/DH2e/templates/actor/character-sheet.html',
			width: 750,
			height: 790,
			submitOnChange: true,
			tabs: [{ navSelector: '.sheet-tabs', contentSelector: '.tab-container', initial: 'stats' }]
		});
	}

	/**
	 * RU: Подготавливает контекст данных для шаблона (характеристики, шкала ран).
	 * EN: Prepares template data context (characteristics, wounds bar).
	 */
	getData(options = {}) {
		const context = super.getData(options);
		const system = this.actor.system ?? {};
		context.system = system;
		// RU: Определения 10 характеристик | EN: 10 characteristics definitions
		const defs = [
			{ key: 'ws', label: 'РУК', fullName: 'Навык Рукопашной' },
			{ key: 'bs', label: 'СТР', fullName: 'Навык Стрельбы' },
			{ key: 's', label: 'СИЛ', fullName: 'Сила' },
			{ key: 't', label: 'ВЫН', fullName: 'Выносливость' },
			{ key: 'ag', label: 'ЛВК', fullName: 'Ловкость' },
			{ key: 'int', label: 'ИНТ', fullName: 'Интеллект' },
			{ key: 'per', label: 'ВОС', fullName: 'Восприятие' },
			{ key: 'wp', label: 'ВОЛ', fullName: 'Сила Воли' },
			{ key: 'fel', label: 'ОБЩ', fullName: 'Общительность' },
			{ key: 'inf', label: 'ВЛИ', fullName: 'Влияние' }
		];
		context.characteristics = defs.map(def => ({
			...def,
			value: system?.characteristics?.[def.key]?.value ?? 25
		}));

		// RU: Процент заполнения шкалы ран (округлён до целого для CSS-правил) | EN: Wounds bar fill percent (rounded)
		const maxW = Number(system.wounds?.maximum ?? 0);
		const curW = Number(system.wounds?.current ?? 0);
		const rawPercent = maxW > 0
			? Math.min(Math.max((curW / maxW) * 100, 0), 100)
			: 0;
		context.woundsPercent = Math.round(rawPercent);

		// RU: Список предметов актёра для вкладки "Свойства" | EN: Actor items for the Properties tab
		const itemArray = (this.actor.items && this.actor.items.contents) ? this.actor.items.contents : [];
		context.items = itemArray.map(it => ({ id: it.id, name: it.name, img: it.img, type: it.type }));

		return context;
	}

	/**
	 * RU: Навешивает события на элементы шаблона (клики по статам, инициатива, редактирование).
	 * EN: Binds events to template elements (stat rolls, initiative, editing).
	 */
	activateListeners(html) {
		super.activateListeners(html);

		// RU: Бросок по характеристике кликом по её аббревиатуре | EN: Roll on stat by clicking its label
		html.find('.attr .abbr.rollable').on('click', this._onRollCharacteristic.bind(this));

		// RU: Сохранение чисел в шкале ран при редактировании | EN: Save wounds numbers after edit
		html.find('.wounds-edit')
			.on('keydown', ev => {
				if (ev.key === 'Enter') {
					ev.preventDefault();
					const span = ev.currentTarget;
					span.blur();
				}
			})
			.on('blur', event => {
				const span = event.currentTarget;
				const path = span.dataset.path;
				let value = parseInt(span.innerText);
				if (isNaN(value) || value < 0) value = 0;
				this.actor.update({ [path]: value });
			});

		// RU: Сохранение «Судьба (текущее)» при Enter/blur | EN: Save Fate current on Enter/blur
		html.find('.fate-current')
			.on('keydown', ev => {
				if (ev.key === 'Enter') {
					ev.preventDefault();
					const span = ev.currentTarget;
					span.blur();
				}
			})
			.on('blur', event => {
				const span = event.currentTarget;
				const path = span.dataset.path;
				let value = parseInt(span.innerText);
				if (isNaN(value) || value < 0) value = 0;
				this.actor.update({ [path]: value });
			});

		// RU: Открыть диалог настроек | EN: Open settings dialog
		html.find('.sheet-settings').on('click', this._openCharEditDialog.bind(this));

		// Инициатива удалена с листа — обработчик не вешаем | Initiative block removed

		// RU: Удаление предмета из вкладки Свойства (делегирование на корневой элемент приложения)
		// EN: Delete item from Properties tab (delegate to app root element)
		this.element.off('click.dh2e-delete');
        this.element.on('click.dh2e-delete', '.item-delete', this._onDeleteItem.bind(this));

		// RU: Открытие предмета по клику на название | EN: Open item sheet on name click
		this.element.off('click.dh2e-open');
		this.element.on('click.dh2e-open', '.item-open', this._onOpenItem.bind(this));

		// DnD обрабатывается переопределением _onDrop, чтобы не было дублей
	}

	/**
	 * RU: Обработчик удаления предмета из списка свойств.
	 * EN: Handler to delete an item from the properties list.
	 */
	async _onDeleteItem(event) {
		event.preventDefault();
		event.stopPropagation();
		const button = event.currentTarget;
		const li = button.closest('[data-item-id]');
		const id = button?.dataset?.itemId || li?.dataset?.itemId;
		if (!id) return;
		const item = this.actor.items?.get?.(id);
		const wasHomeworld = item?.type === 'homeworld';
		await this.actor.deleteEmbeddedDocuments('Item', [id]);
		// If homeworld removed, recalc header from remaining items
		if (wasHomeworld) {
			const remainingHomeworlds = this.actor.items.filter(i => i.type === 'homeworld');
			const newValue = remainingHomeworlds.length > 0 ? remainingHomeworlds[0].name : '';
			const update = { 'system.profile.homeworld': newValue };
			if (!newValue) {
				update['system.wounds.maximum'] = 0;
				update['system.wounds.current'] = 0;
				update['system.fate.maximum'] = 0;
				update['system.fate.current'] = 0;
			}
			await this.actor.update(update);
		}
	}

	/**
	 * RU: Открыть окно предмета из списка свойств
	 * EN: Open item sheet from properties list
	 */
	async _onOpenItem(event) {
		event.preventDefault();
		const id = event.currentTarget?.dataset?.itemId;
		if (!id) return;
		const item = this.actor.items?.get?.(id);
		if (item) item.sheet?.render(true);
	}

	/**
	 * RU: Централизованный обработчик DnD. Для Item создаём один документ и синхронизируем шапку.
	 * EN: Centralized DnD handler. For Item, create single document and sync header.
	 */
	async _onDrop(event) {
		// Don't call super for Items to avoid double-create
		let data;
		try {
			const dt = event.originalEvent?.dataTransfer ?? event.dataTransfer;
			if (!dt) return await super._onDrop(event);
			data = JSON.parse(dt.getData('text/plain'));
		} catch (e) {
			return await super._onDrop(event);
		}

		// Handle Items only
		const isItem = data?.type === 'Item' || (typeof data?.uuid === 'string' && data.uuid.includes('Item.'));
		if (!isItem) return await super._onDrop(event);

		event.preventDefault();
		event.stopPropagation();

		let itemDoc = null;
		if (data?.uuid) {
			try { itemDoc = await fromUuid(data.uuid); } catch (e) { /* noop */ }
		}
		if (!itemDoc && data?.pack && data?.id) {
			try { const pack = game.packs.get(data.pack); itemDoc = await pack.getDocument(data.id); } catch (e) { /* noop */ }
		}
		if (!itemDoc && data?.type === 'Item' && data?.data) {
			try { itemDoc = new Item(data.data); } catch (e) { /* noop */ }
		}
		if (!itemDoc) return null;

		const createData = itemDoc.toObject ? itemDoc.toObject() : itemDoc;
		delete createData._id;
		const created = await this.actor.createEmbeddedDocuments('Item', [createData]);
		const createdItemId = Array.isArray(created) ? created[0]?.id : created?.id;
		const createdItem = createdItemId ? this.actor.items.get(createdItemId) : null;
		if (createdItem && createdItem.type === 'homeworld') {
			await this.actor.update({ 'system.profile.homeworld': createdItem.name });
			// Evaluate wounds formula from the homeworld and set maximum wounds
			const formula = createdItem.system?.woundsFormula?.trim();
			if (formula && typeof formula === 'string') {
				try {
					const roll = await (new Roll(formula)).evaluate();
					const max = Number(roll.total) || 0;
					await this.actor.update({ 'system.wounds.maximum': max });
					// Send chat card about the wounds roll
					await roll.toMessage({
						user: game.user.id,
						speaker: ChatMessage.getSpeaker({ actor: this.actor }),
						flavor: `
							<div class="dh2e-roll-header">Раны: ${createdItem.name}</div>
							<div class="dh2e-degrees">Формула: ${formula}</div>
							<div class="dh2e-roll-result">Результат: ${max}</div>
						`,
						flags: { dh2e: { type: 'wounds', itemId: createdItem.id, itemName: createdItem.name, formula, total: max } }
					});
				} catch (e) {
					console.warn('DH2e | Invalid wounds formula on homeworld:', formula, e);
				}
			}

			// Fate points: set maximum from homeworld base, roll blessing 1d10, +1 max if passed
			const baseFate = Number(createdItem.system?.fateBase ?? 0);
			const threshold = Number(createdItem.system?.blessingThreshold ?? 0); // 1..10
			let fateMax = Math.max(0, baseFate);
			if (threshold >= 1 && threshold <= 10) {
				try {
					const blessRoll = await (new Roll('1d10')).evaluate();
					const die = Number(blessRoll.total) || 0;
					if (die >= threshold) fateMax = fateMax + 1;
					await this.actor.update({ 'system.fate.maximum': fateMax, 'system.fate.current': fateMax });
					await blessRoll.toMessage({
						user: game.user.id,
						speaker: ChatMessage.getSpeaker({ actor: this.actor }),
						flavor: `
							<div class="dh2e-roll-header">Благословение Императора: ${createdItem.name}</div>
							<div class="dh2e-degrees">Порог: ${threshold} &nbsp;•&nbsp; Кость: ${die}</div>
							<div class="dh2e-roll-result">${die >= threshold ? 'Порог достигнут — +1 к максимуму Судьбы' : 'Порог не достигнут'}</div>
						`,
						flags: { dh2e: { type: 'blessing', itemId: createdItem.id, itemName: createdItem.name, threshold, die, fateMax } }
					});
				} catch (e) {
					console.warn('DH2e | Blessing roll failed', e);
				}
			} else {
				await this.actor.update({ 'system.fate.maximum': fateMax, 'system.fate.current': fateMax });
			}

			// RU: После применения ран и судьбы — спросить тип генерации характеристик
			// EN: After wounds and fate, ask for characteristics generation mode
			const mode = await new Promise(resolve => {
				const dlg = new Dialog({
					title: 'Выберите тип генерации характеристик',
					content: `<div style="text-align:center; padding:6px 0;">Выберите тип генерации характеристик</div>`,
					buttons: {
						pointbuy: { label: 'Поинт-бай', callback: () => resolve('pointbuy') },
						generate: { label: 'Генерация', callback: () => resolve('generate') }
					},
					default: 'generate'
				}, { classes: ['dh2e'] });
				dlg.render(true);
			});

			if (mode === 'generate') {
				const defs = [
					{ key: 'ws', name: 'Навык Рукопашной' },
					{ key: 'bs', name: 'Навык Стрельбы' },
					{ key: 's',  name: 'Сила' },
					{ key: 't',  name: 'Выносливость' },
					{ key: 'ag', name: 'Ловкость' },
					{ key: 'int',name: 'Интеллект' },
					{ key: 'per',name: 'Восприятие' },
					{ key: 'wp', name: 'Сила Воли' },
					{ key: 'fel',name: 'Общительность' },
					{ key: 'inf',name: 'Влияние' }
				];
				const plusSet = new Set([createdItem.system?.modPlus1, createdItem.system?.modPlus2].filter(Boolean));
				const minusKey = createdItem.system?.modMinus || '';
				const update = {};
				let rows = '';
				for (const d of defs) {
					let formula = '2d10+20';
					if (plusSet.has(d.key)) formula = '3d10kh2+20';
					else if (d.key === minusKey) formula = '3d10kl2+20';
					let roll, total = 0;
					try {
						roll = await (new Roll(formula)).evaluate();
						total = Number(roll.total) || 0;
					} catch (e) { total = 20; }
					update[`system.characteristics.${d.key}.value`] = total;
					rows += `<tr><td>${d.name}</td><td>${formula}</td><td>${total}</td></tr>`;
				}
				await this.actor.update(update);
				const table = `
					<div class="dh2e-roll-header">Генерация характеристик: ${createdItem.name}</div>
					<table class="dh2e-gen-table">
						<thead><tr><th>Характеристика</th><th>Бросок</th><th>Итог</th></tr></thead>
						<tbody>${rows}</tbody>
					</table>
				`;
				await ChatMessage.create({
					user: game.user.id,
					speaker: ChatMessage.getSpeaker({ actor: this.actor }),
					content: table,
					flags: { dh2e: { type: 'gen', itemId: createdItem.id, itemName: createdItem.name } }
				});
			} else if (mode === 'pointbuy') {
				const defs = [
					{ key: 'ws', name: 'Навык Рукопашной' },
					{ key: 'bs', name: 'Навык Стрельбы' },
					{ key: 's',  name: 'Сила' },
					{ key: 't',  name: 'Выносливость' },
					{ key: 'ag', name: 'Ловкость' },
					{ key: 'int',name: 'Интеллект' },
					{ key: 'per',name: 'Восприятие' },
					{ key: 'wp', name: 'Сила Воли' },
					{ key: 'fel',name: 'Общительность' },
					{ key: 'inf',name: 'Влияние' }
				];
				const plusSet = new Set([createdItem.system?.modPlus1, createdItem.system?.modPlus2].filter(Boolean));
				const minusKey = createdItem.system?.modMinus || '';
				const start = {};
				for (const d of defs) start[d.key] = plusSet.has(d.key) ? 30 : 25; // "-" также 25
				let values = { ...start };
				const totalPool = 60;
				const calcRemaining = () => {
					let spent = 0;
					for (const d of defs) spent += (values[d.key] - start[d.key]);
					return Math.max(0, totalPool - spent);
				};

				const rowsHtml = defs.map(d => `
					<tr data-key="${d.key}">
						<td class="pb-name">${d.name}</td>
						<td class="pb-controls">
							<button type="button" class="pb-dec">−</button>
							<span class="pb-value">${values[d.key]}</span>
							<button type="button" class="pb-inc">+</button>
						</td>
					</tr>
				`).join('');

				const content = `
					<div style=\"margin-bottom:6px; text-align:center;\">Распределите 60 очков</div>
					<div class="pb-remaining">Осталось: <b class="pb-left">${totalPool}</b></div>
					<table class="dh2e-gen-table pb-table">
						<tbody>${rowsHtml}</tbody>
					</table>
				`;

				await new Promise(resolve => {
					const dlg = new Dialog({
						title: 'Поинт-бай характеристик',
						content,
						buttons: {
							save: { label: 'Сохранить', callback: async () => {
								const update = {};
								for (const d of defs) update[`system.characteristics.${d.key}.value`] = Math.min(values[d.key], 40);
								await this.actor.update(update);
								resolve(true);
							}},
							cancel: { label: 'Отмена', callback: () => resolve(false) }
						},
						default: 'save'
					}, { classes: ['dh2e'] });

					const onRender = (app, html) => {
						if (app !== dlg) return;
						const saveBtn = html.find('.dialog-button:contains("Сохранить")');
						const leftEl = html.find('.pb-left');
						const updateUI = () => {
							const left = calcRemaining();
							leftEl.text(String(left));
							saveBtn.prop('disabled', left !== 0);
							html.find('.pb-value').each((_, el) => {
								const tr = el.closest('tr');
								const key = tr.dataset.key;
								el.textContent = String(values[key]);
							});
						};

						html.find('.pb-inc').on('click', ev => {
							const tr = ev.currentTarget.closest('tr');
							const key = tr.dataset.key;
							if (calcRemaining() <= 0) return;
							if (values[key] >= 40) return;
							values[key] += 1;
							updateUI();
						});
						html.find('.pb-dec').on('click', ev => {
							const tr = ev.currentTarget.closest('tr');
							const key = tr.dataset.key;
							if (values[key] <= start[key]) return;
							values[key] -= 1;
							updateUI();
						});

						updateUI();
					};

					const onClose = (app) => {
						if (app !== dlg) return;
						Hooks.off('renderDialog', onRender);
						Hooks.off('closeDialog', onClose);
					};

					Hooks.on('renderDialog', onRender);
					Hooks.on('closeDialog', onClose);
					dlg.render(true);
				});
			}
		}
		return created;
	}

	/**
	 * RU: Бросок по характеристике с модификатором и расчётом степеней.
	 * EN: Roll versus characteristic with modifier and DoS/DoF calculation.
	 */
	async _onRollCharacteristic(event) {
		event.preventDefault();
		const target = event.currentTarget.closest('.attr');
		const key = target?.dataset?.key;
		if (!key) return;

		const defs = [
			{ key: 'ws', fullName: 'Навык Рукопашной' },
			{ key: 'bs', fullName: 'Навык Стрельбы' },
			{ key: 's', fullName: 'Сила' },
			{ key: 't', fullName: 'Выносливость' },
			{ key: 'ag', fullName: 'Ловкость' },
			{ key: 'int', fullName: 'Интеллект' },
			{ key: 'per', fullName: 'Восприятие' },
			{ key: 'wp', fullName: 'Сила Воли' },
			{ key: 'fel', fullName: 'Общительность' },
			{ key: 'inf', fullName: 'Влияние' }
		];

		const fullName = defs.find(d => d.key === key)?.fullName || key;
		const baseTarget = this.actor.system?.characteristics?.[key]?.value ?? 25;

		// RU: Выбор модификатора в диалоге | EN: Choose roll modifier in dialog
		const modifier = await this._promptModifier();
		const targetValue = baseTarget + modifier;

		const roll = await (new Roll('1d100')).evaluate();
		const result = roll.total;

		let outcome = '';
		let degrees = '';

		if (result <= targetValue) {
			const delta = targetValue - result;
			const degreesOfSuccess = 1 + Math.floor(delta / 10);
			outcome = '<div class="dh2e-success">Успех!</div>';
			degrees = `<div class="dh2e-degrees">Степень успеха: ${degreesOfSuccess}</div>`;
		} else {
			const delta = result - targetValue;
			const degreesOfFailure = 1 + Math.floor(delta / 10);
			outcome = '<div class="dh2e-failure">Провал</div>';
			degrees = `<div class="dh2e-degrees">Степень провала: ${degreesOfFailure}</div>`;
		}

		await roll.toMessage({
			user: game.user.id,
			speaker: ChatMessage.getSpeaker({ actor: this.actor }),
			flavor: `
				<div class="dh2e-roll-header">
					${fullName} (${targetValue})
				</div>
				${outcome}
				${degrees}
				<div class="dh2e-roll-result">Результат: ${result}</div>
			`,
			flags: { dh2e: { characteristic: key, fullName, baseTarget, modifier, targetValue } }
		});
	}

	/**
	 * RU: Диалог выбора модификатора (−60…+60, шаг 10).
	 * EN: Modifier selection dialog (−60…+60, step 10).
	 */
	async _promptModifier() {
		const values = Array.from({ length: 13 }, (_, i) => -60 + i * 10); // -60..+60
		const buttonsHtml = values.map(v => {
			const cls = v === 0 ? 'mod-zero' : (v > 0 ? 'mod-pos' : 'mod-neg');
			const sign = v > 0 ? `+${v}` : `${v}`;
			return `<button type="button" class="mod-btn ${cls}" data-value="${v}">${sign}</button>`;
		}).join('');

		const content = `<div class="mod-grid">${buttonsHtml}</div>`;

		return new Promise(resolve => {
			const dlg = new Dialog({
				title: 'Модификатор теста',
				content,
				buttons: {} // без кнопки OK
			}, { classes: ['dh2e'] });

			const onRender = (app, html) => {
				if (app !== dlg) return;
				html.find('.mod-btn').on('click', ev => {
					const val = Number(ev.currentTarget.dataset.value);
					if (!Number.isNaN(val)) {
						resolve(val);
						dlg.close(); // закрыть сразу после выбора
					}
				});
			};

			const onClose = (app) => {
				if (app !== dlg) return;
				Hooks.off('renderDialog', onRender);
				Hooks.off('closeDialog', onClose);
			};

			Hooks.on('renderDialog', onRender);
			Hooks.on('closeDialog', onClose);
			dlg.render(true);
		});
	}

	/**
	 * RU: Диалог редактирования характеристик (поля профиля удалены из настроек).
	 * EN: Edit dialog for characteristics only (profile fields removed from settings).
	 */
	async _openCharEditDialog() {
		const defs = [
			{ key: 'ws', label: 'Навык Рукопашной' },
			{ key: 'bs', label: 'Навык Стрельбы' },
			{ key: 's', label: 'Сила' },
			{ key: 't', label: 'Выносливость' },
			{ key: 'ag', label: 'Ловкость' },
			{ key: 'int', label: 'Интеллект' },
			{ key: 'per', label: 'Восприятие' },
			{ key: 'wp', label: 'Сила Воли' },
			{ key: 'fel', label: 'Общительность' },
			{ key: 'inf', label: 'Влияние' }
		];

		const ch = this.actor.system?.characteristics ?? {};
		const inputs = defs.map(d => {
			const val = Number(ch?.[d.key]?.value ?? 25);
			return `
      		<label class="char-edit-row">
				<span class="char-edit-label">${d.label}</span>
				<input type="number" name="char.${d.key}" value="${val}" min="0" max="100" step="1"/>
			</label>
     	`;
		}).join('');

		const content = `
    	<form class="dh2e char-edit-form">
      		<div class="char-edit-grid">
        		${inputs}
      		</div>
    	</form>
  		`;

		return new Promise(resolve => {
			const dlg = new Dialog({
				title: 'Характеристики',
				content,
				buttons: {
					save: {
						label: 'Сохранить',
						callback: html => {
							const form = html[0].querySelector('.char-edit-form');
							const formData = new FormData(form);
							const update = {};
							for (const [k, v] of formData.entries()) {
								if (k.startsWith('char.')) {
									const key = k.split('.')[1];
									const num = Number(v);
									update[`system.characteristics.${key}.value`] = Number.isFinite(num) ? num : 0;
								}
							}
							this.actor.update(update);
							resolve(true);
						}
					},
					cancel: { label: 'Отмена', callback: () => resolve(false) }
				},
				default: 'save'
			}, { classes: ['dh2e', 'char-edit-dialog'], width: 600, resizable: true });

			dlg.render(true);
		});
	}

	/**
	 * RU: Бросок инициативы (1d10 + мод ЛВК) и запись в combat.
	 * EN: Initiative roll (1d10 + Ag mod) and set to combat.
	 */
	async _onRollInitiative(event) {
		const ag = Number(this.actor.system?.characteristics?.ag?.value ?? 25);
		const agMod = Math.floor(ag / 10);

		const roll = await (new Roll('1d10')).evaluate();
		const die = roll.total;
		const total = die + agMod;

		await roll.toMessage({
			user: game.user.id,
			speaker: ChatMessage.getSpeaker({ actor: this.actor }),
			flavor: `
			<div class="dh2e-roll-header">Инициатива</div>
			<div class="dh2e-degrees">1d10: ${die} &nbsp;•&nbsp; Мод ЛВК: ${agMod}</div>
			<div class="dh2e-roll-result">Результат: ${total}</div>
		`,
			flags: { dh2e: { type: 'initiative', ag, agMod, die, total } }
		});

		// Записать инициативу в текущий бой (если он есть)
		const combat = game.combat;
		if (combat) {
			const cb = combat.combatants.find(c => c.actorId === this.actor.id);
			if (cb) {
				await combat.setInitiative(cb.id, Number(total));
			}
		}
	}


}




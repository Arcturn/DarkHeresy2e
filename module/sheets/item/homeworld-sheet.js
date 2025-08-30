// DH2e Homeworld Item Sheet
// RU: Лист предмета "Родной мир". Тумблер editable переводит поля в режим редактирования/только чтение.
// EN: "Homeworld" item sheet. The editable toggle switches fields between edit/read-only.

class DH2eHomeworldSheet extends ItemSheet {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ['dh2e', 'sheet', 'item', 'homeworld'],
			template: 'systems/DH2e/templates/item/homeworld-sheet.html',
			width: 500,
			height: 420,
			submitOnChange: true,
			tabs: [{ navSelector: '.tabs', contentSelector: '.sheet-body', initial: 'description' }]
		});
	}

	async getData(options = {}) {
		const context = await super.getData(options);
		context.system = this.item.system ?? {};
		// RU: Флаг режима редактирования берём из данных предмета
		// EN: Edit-mode flag comes from item data
		context.isEditableMode = !!context.system?.editable;
		// RU: Нужно для логики прав и тулбара редактора | EN: Permission and toolbar flags
		context.owner = this.item.isOwner;
		context.canEditEditor = !!(this.isEditable && context.isEditableMode);
		// RU: Текст для режима только чтения | EN: Read-only enriched text
		context.enrichedDescription = await TextEditor.enrichHTML(context.system?.description ?? '', { async: true });
		return context;
	}

	activateListeners(html) {
		super.activateListeners(html);
		// RU: Переключатель режима — обновляем флаг и перерисовываем лист
		// EN: Toggle edit mode — update flag and re-render sheet
		html.find('.hw-editable-toggle').on('change', async ev => {
			const checked = ev.currentTarget.checked;
			await this.item.update({ 'system.editable': checked });
			this.render(true);
		});

		// RU: Принудительно применить readonly к полям в зависимости от режима
		// EN: Force readonly state on inputs according to edit mode
		const isEditableMode = !!this.item.system?.editable;
		html.find('h1.name input, input[name="system.woundsFormula"], input[name="system.fateBase"], input[name="system.blessingThreshold"]').each((_, el) => {
			el.readOnly = !isEditableMode;
			el.disabled = false; // never disable, just readonly when locked
		});
	}
}

// expose globally
globalThis.DH2eHomeworldSheet = DH2eHomeworldSheet;

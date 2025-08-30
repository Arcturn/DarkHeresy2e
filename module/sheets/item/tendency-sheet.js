// DH2e Tendency Item Sheet
// RU: Лист предмета "Склонность". Минимал: вкладки Описание/Свойства, привязка к характеристике.

class DH2eTendencySheet extends ItemSheet {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ['dh2e', 'sheet', 'item', 'tendency'],
			template: 'systems/DH2e/templates/item/tendency-sheet.html',
			width: 480,
			height: 380,
			submitOnChange: true,
			tabs: [{ navSelector: '.tabs', contentSelector: '.sheet-body', initial: 'properties' }]
		});
	}

	async getData(options = {}) {
		const context = await super.getData(options);
		context.system = this.item.system ?? {};
		context.isEditableMode = !!context.system?.editable;
		context.owner = this.item.isOwner;
		return context;
	}

	activateListeners(html) {
		super.activateListeners(html);
		html.find('.tendency-editable-toggle').on('change', async ev => {
			const checked = ev.currentTarget.checked;
			await this.item.update({ 'system.editable': checked });
			this.render(true);
		});

		const isEditableMode = !!this.item.system?.editable;
		html.find('h1.name input, select[name="system.bindCharacteristic"]').each((_, el) => {
			if (el.tagName === 'SELECT') {
				el.disabled = !isEditableMode;
			} else {
				el.readOnly = !isEditableMode;
			}
		});
	}
}

globalThis.DH2eTendencySheet = DH2eTendencySheet;



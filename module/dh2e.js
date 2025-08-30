/*
 * DH2e system bootstrap (Foundry VTT v13)
 * RU: Точка входа системы. Регистрирует листы, хелперы Handlebars, формулу инициативы и выводит сервисные логи.
 * EN: System entry point. Registers sheets, Handlebars helpers, initiative formula and prints service logs.
 */

Hooks.once('init', () => {
	console.log('DH2e | init');
	// RU: Названия типов актёров | EN: Actor type labels
	CONFIG.Actor.typeLabels = {
		character: 'DH2e.ActorType.Character'
	};
	// RU: Названия типов предметов | EN: Item type labels
	CONFIG.Item.typeLabels = CONFIG.Item.typeLabels || {};
	CONFIG.Item.typeLabels.homeworld = 'Родной мир';
	CONFIG.Item.typeLabels.tendency = 'Склонность';

	// RU: Формула инициативы (1d10 + ЛВК/10, округление вниз)
	// EN: Initiative formula (1d10 + Agility/10, floor)
	CONFIG.Combat.initiative = {
		formula: "1d10 + floor(@system.characteristics.ag.value / 10)",
		decimals: 0
	};

	// RU: Регистрация вспомогательных хелперов Handlebars
	// EN: Register Handlebars helper utilities
	Handlebars.registerHelper('math', function (lvalue, operator, rvalue, options) {
		const operators = {
			'+': lvalue + rvalue,
			'-': lvalue - rvalue,
			'*': lvalue * rvalue,
			'/': lvalue / rvalue,
			'%': lvalue % rvalue
		};
		return operators[operator];
	});

	Handlebars.registerHelper('modifier', function (value) {
		if (!Number.isFinite(value)) return 0;
		return Math.floor(value / 10);
	});
});

Hooks.once('ready', () => {
	console.log('DH2e | ready');
});

// RU: Регистрация кастомного листа персонажа и листов предметов | EN: Register sheets
Hooks.once('setup', () => {
	try {
		// Sheet file is loaded via scripts in system.json, class is global
		if (typeof DH2eCharacterSheet !== 'undefined') {
			Actors.unregisterSheet('core', ActorSheet);
			Actors.registerSheet('DH2e', DH2eCharacterSheet, { types: ['character'], makeDefault: true });
		}
		if (typeof DH2eHomeworldSheet !== 'undefined') {
			Items.unregisterSheet('core', ItemSheet);
			Items.registerSheet('DH2e', DH2eHomeworldSheet, { types: ['homeworld'], makeDefault: true });
		}
		if (typeof DH2eTendencySheet !== 'undefined') {
			Items.registerSheet('DH2e', DH2eTendencySheet, { types: ['tendency'], makeDefault: true });
		}
	} catch (err) {
		console.error('DH2e | Failed to register sheets', err);
	}
});

// RU: Если тип предмета не указан при создании — ставим 'homeworld' по умолчанию
// EN: If item type is missing on creation — default to 'homeworld'
Hooks.on('preCreateItem', (item, data) => {
	if (!data.type) {
		item.updateSource({ type: 'homeworld' });
	}
});



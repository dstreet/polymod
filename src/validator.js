const inspector = require('schema-inspector')

module.exports = {
	parseType(type, required) {
		if (typeof type === 'undefined') return { type: 'any', optional: true }

		if (Array.isArray(type)) {
			return {
				type: 'array',
				optional: !required,
				items: type.length > 1 ? type.map(item => this.parseType(item), required) : this.parseType(type[0], required)
			}
		}

		if (typeof type === 'function') {
			return { ...expandTypeConstructor(type), optional: !required }
		}

		if (typeof type === 'object' && !type.type) {
			return {
				type: 'object',
				optional: !required,
				properties: Object.keys(type).reduce((acc, key) => ({
					...acc,
					[key]: this.parseType(type[key], required)
				}), {})	
			}
		} else if (type.type) {
			let finalType

			if (typeof type.type === 'function') {
				finalType = {
					...type,
					...expandTypeConstructor(type.type),
					optional: !required
				}
			} else {
				finalType = type
			}

			if (type.validator) {
				finalType = {
					...finalType,
					exec: function(schema, val) {
						if (!type.validator.fn(val)) {
							this.report(type.validator.message(schema, val))
						}
					}
				}
			}

			return finalType
		} else {
			return type
		}
	},

	validate(schema, data) {
		return inspector.validate(schema, data)
	}
}

function expandTypeConstructor(type) {
	switch (type) {
		case String:
			return { type: 'string' }
		case Number:
			return { type: 'number' }
		case Date:
			return { type: 'date' }
		case Boolean:
			return { type: 'boolean' }
		default:
			return { type }
	}
}
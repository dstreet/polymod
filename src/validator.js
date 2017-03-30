const inspector = require('schema-inspector')

module.exports = {
	parseType(type, required) {
		if (Array.isArray(type)) {
			return {
				type: 'array',
				optional: !required,
				items: type.length > 1 ? type.map(item => this.parseType(item), required) : this.parseType(type[0], required)
			}
		}

		if (typeof type === 'function') {
			switch (type) {
				case String:
					return { type: 'string', optional: !required }
				case Number:
					return { type: 'number', optional: !required }
				case Date:
					return { type: 'Date', optional: !required }
				case Boolean:
					return { type: 'boolean', optional: !required }
				default:
					return { type, optional: !required }
			}
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
		} else {
			return type
		}
	},

	validate(schema, data) {
		return inspector.validate(schema, data)
	}
}
const inspector = require('schema-inspector')

module.exports = {
	parseType(type) {
		if (Array.isArray(type)) {
			return {
				type: 'array',
				items: type.length > 1 ? type.map(item => this.parseType(item)) : this.parseType(type[0])
			}
		}

		if (typeof type === 'function') {
			switch (type) {
				case String:
					return { type: 'string' }
				case Number:
					return { type: 'number' }
				case Date:
					return { type: 'Date' }
				case Boolean:
					return { type: 'boolean' }
				default:
					return { type }
			}
		}

		if (typeof type === 'object' && !type.type) {
			return {
				type: 'object',
				properties: Object.keys(type).reduce((acc, key) => ({
					...acc,
					[key]: this.parseType(type[key])
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
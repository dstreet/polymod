/* eslint-env jest */
const validator = require('./validator')

describe('parseType()', () => {
	test('Array - all elements the same', () => {
		expect(validator.parseType([String], true)).toEqual({
			type: 'array',
			optional: false,
			items: { type: 'string', optional: false }
		})
	})

	test('Array - element positions', () => {
		expect(validator.parseType([String, Number])).toEqual({
			type: 'array',
			optional: true,
			items: [
				{ type: 'string', optional: true },
				{ type: 'number', optional: true }
			]
		})
	})

	test('Object - simplified format', () => {
		expect(validator.parseType({ foo: String, bar: Number })).toEqual({
			type: 'object',
			optional: true,
			properties: {
				foo: { type: 'string', optional: true },
				bar: { type: 'number', optional: true }
			}
		})
	})

	test('Object - expanded format', () => {
		expect(validator.parseType({ type: 'string', minLength: 4 })).toEqual({
			type: 'string',
			minLength: 4
		})
	})

	test('Array - all elements of object type', () => {
		expect(validator.parseType([{ name: String }], true)).toEqual({
			type: 'array',
			optional: false,
			items: {
				type: 'object',
				optional: false,
				properties: {
					name: { type: 'string', optional: false }
				}
			}
		})
	})

	test('Custom validator', () => {
		const schema = validator.parseType({
			type: Number,
			validator: {
				fn: val => val < 100,
				message: (schema, val) => `must be less than 100. Got ${val}`
			}
		})
		
		expect(schema).toHaveProperty('type', 'number')
		expect(schema).toHaveProperty('optional', true)
		expect(schema).toHaveProperty('exec')
	})
})

describe('validate()', () => {
	test('valid', () => {
		const schema = {
			type: 'object',
			properties: {
				username: { type: 'string' },
				name: {
					type: 'object',
					properties: {
						first: { type: 'string' },
						last: { type: 'string' }
					}
				}
			}
		}

		expect(validator.validate(schema, {
			username: 'jdoe',
			name: { first: 'John', last: 'Doe' }
		})).toHaveProperty('valid', true)
	})

	test('invalid type', () => {
		const schema = {
			type: 'object',
			properties: {
				username: { type: 'string' },
				name: {
					type: 'object',
					properties: {
						first: { type: 'string' },
						last: { type: 'string' }
					}
				}
			}
		}

		expect(validator.validate(schema, {
			username: 'jdoe',
			name: { first: 'John', last: 5 }
		})).toHaveProperty('valid', false)
	})

	test('missing required property', () => {
		const schema = {
			type: 'object',
			properties: {
				username: { type: 'string' },
				name: {
					type: 'object',
					properties: {
						first: { type: 'string' },
						last: { type: 'string' }
					}
				}
			}
		}

		expect(validator.validate(schema, {
			name: { first: 'John', last: 'Doe' }
		})).toHaveProperty('valid', false)
	})

	test('custom validator', () => {
		const schema = validator.parseType({
			type: Number,
			validator: {
				fn: val => val < 100,
				message: (schema, val) => `must be less than 100. Got ${val}`
			}
		})
		
		const res = validator.validate(schema, 101)

		expect(res).toHaveProperty('valid', false)
		expect(res.error[0]).toHaveProperty('message', 'must be less than 100. Got 101')
	})
})
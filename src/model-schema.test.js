/* eslint-env jest */
const ModelSchema = require('./model-schema')
const Schema = require('./schema')
const Model = require('./model')
const Query = require('./query')
const MemStore = require('./mem-store')
const Document = require('./document')

it('should get a new document using the model\'s sources',  async() => {
	const store = new MemStore({
		users: [
			{
				id: 1,
				username: 'jdoe',
				name: {
					first: 'John',
					last: 'Doe'
				}
			}
		],
		userMeta: [
			{
				id: 1,
				user: 1,
				meta: { active: true }
			}
		]
	})
	const UsersSchema = new Schema(store, 'users')
	const UserMetaSchema = new Schema(store, 'userMeta')

	const User = Model
		.create()
		.addSource('user', UsersSchema)
		.describe({
			id: {
				type: Number,
				data: ({ user }) => user.id
			},
			username: {
				type: String,
				data: ({ user }) => user.username
			},
			name: {
				type: {
					first: String,
					last: String
				},
				data: ({ user }) => user.name
			}
		})
		.addQuery('default',
			Query
				.create()
				.input(id => ({ user: { id } }))
				.populate('user', ({ user }) => ({ id: user.id }))
		)

	const UserModelSchema = new ModelSchema(User, 'default')

	const UserMeta = Model
		.create()
		.addSource('meta', UserMetaSchema)
		.addSource('user', UserModelSchema)
		.describe({
			user: {
				type: UserModelSchema.type,
				data: ({ user }) => user
			},
			meta: {
				data: ({ meta }) => meta.meta
			}
		})
		.addQuery('default',
			Query
				.create()
				.input(id => ({ meta: { user: id } }))
				.populate('meta', ({ meta }) => ({ user: meta.user }))
				.populate('user', ({ meta }) => meta.user)
		)

	const doc = await UserMeta.get(1)
	expect(doc instanceof Document).toBeTruthy()
	expect(doc.data).toEqual({
		user: {
			id: 1,
			username: 'jdoe',
			name: { first: 'John', last: 'Doe' }
		},
		meta: { active: true }
	})
})

it('should create a new document using the model\'s sources', async () => {
	const store = new MemStore({
		users: [
			{
				id: 1,
				username: 'jdoe',
				name: {
					first: 'John',
					last: 'Doe'
				}
			},
			{
				id: 2,
				username: 'twaits',
				name: {
					first: 'Tom',
					last: 'Waits'
				}
			}
		],
		userMeta: [
			{
				id: 1,
				user: 1,
				meta: { active: true }
			}
		]
	})
	const UsersSchema = new Schema(store, 'users')
	const UserMetaSchema = new Schema(store, 'userMeta')

	const User = Model
		.create()
		.addSource('user', UsersSchema)
		.describe({
			id: {
				type: Number,
				data: ({ user }) => user.id
			},
			username: {
				type: String,
				data: ({ user }) => user.username,
				mutation: {
					method: { source: 'user', data: username => ({ username }) }
				}
			},
			name: {
				type: {
					first: String,
					last: String
				},
				data: ({ user }) => user.name,
				mutation: {
					method: { source: 'user', data: name => ({ name }) }
				}
			}
		})
		.addQuery('default',
			Query
				.create()
				.input(
					id => ({ user: { id } }),
					({ user }) => user.id
				)
				.populate('user', ({ user }) => ({ id: user.id }))
		)

	const UserModelSchema = new ModelSchema(User, 'default')

	const UserMeta = Model
		.create()
		.addSource('meta', UserMetaSchema)
		.addSource('user', UserModelSchema)
		.describe({
			user: {
				type: UserModelSchema.type,
				data: ({ user }) => user,
				mutation: {
					type: Number,
					method: { source: 'meta', data: id => ({ user: id }) }
				}
			},
			meta: {
				data: ({ meta }) => meta.meta,
				mutation: {
					method: [
						{ source: 'meta', data: id => ({ user: id }), operation: 'delete' },
						{ source: 'meta', data: meta => ({ meta }), operation: 'create' }
					]
				}
			}
		})
		.addQuery('default',
			Query
				.create()
				.input(
					id => ({ meta: { user: id } }),
					({ meta }) => meta.user
				)
				.populate('meta', ({ meta }) => ({ user: meta.user }))
				.populate('user', ({ meta }) => meta.user)
		)

	const [doc] = await UserMeta.create({
		user: 2,
		meta: { active: false }
	})
	expect(doc instanceof Document).toBeTruthy()
	expect(doc.data).toEqual({
		user: {
			id: 2,
			username: 'twaits',
			name: { first: 'Tom', last: 'Waits' }
		},
		meta: { active: false }
	})
})

it('should update a document using the model\'s sources', async () => {
	const store = new MemStore({
		users: [
			{
				id: 1,
				username: 'jdoe',
				name: {
					first: 'John',
					last: 'Doe'
				}
			},
			{
				id: 2,
				username: 'twaits',
				name: {
					first: 'Tom',
					last: 'Waits'
				}
			}
		],
		userMeta: [
			{
				id: 1,
				user: 1,
				meta: { active: true }
			}
		]
	})
	const UsersSchema = new Schema(store, 'users')
	const UserMetaSchema = new Schema(store, 'userMeta')

	const User = Model
		.create()
		.addSource('user', UsersSchema)
		.describe({
			id: {
				type: Number,
				data: ({ user }) => user.id
			},
			username: {
				type: String,
				data: ({ user }) => user.username,
				mutation: {
					method: { source: 'user', data: username => ({ username }) }
				}
			},
			name: {
				type: {
					first: String,
					last: String
				},
				data: ({ user }) => user.name,
				mutation: {
					method: { source: 'user', data: name => ({ name }) }
				}
			}
		})
		.addQuery('default',
			Query
				.create()
				.input(
					id => ({ user: { id } }),
					({ user }) => user.id
				)
				.populate('user', ({ user }) => ({ id: user.id }))
		)

	const UserModelSchema = new ModelSchema(User, 'default')

	const UserMeta = Model
		.create()
		.addSource('meta', UserMetaSchema, false)
		.addSource('user', UserModelSchema, false)
		.describe({
			user: {
				type: UserModelSchema.type,
				data: ({ user }) => user,
				mutation: {
					type: Number,
					method: { source: 'meta', data: id => ({ user: id }) }
				}
			},
			meta: {
				data: ({ meta }) => meta.meta,
				mutation: {
					method: [
						{ source: 'meta', data: (meta, { user }) => ({ user: user.id }), operation: 'delete' },
						{ source: 'meta', data: (meta, { user }) => ({ user: user.id, meta }), operation: 'create' }
					]
				}
			}
		})
		.addQuery('default',
			Query
				.create()
				.input(
					id => ({ meta: { user: id } }),
					({ meta }) => meta.user
				)
				.populate('meta', ({ meta }) => ({ user: meta.user }))
				.populate('user', ({ meta }) => meta.user)
		)

	let doc = await UserMeta.get(1)
	expect(doc instanceof Document).toBeTruthy()
	expect(doc.data).toEqual({
		user: {
			id: 1,
			username: 'jdoe',
			name: { first: 'John', last: 'Doe' }
		},
		meta: { active: true }
	})

	let [doc2] = await doc.mutate({
		meta: { active: false }
	})
	expect(doc2 instanceof Document).toBeTruthy()
	expect(doc2.data).toEqual({
		user: {
			id: 1,
			username: 'jdoe',
			name: { first: 'John', last: 'Doe' }
		},
		meta: { active: false }
	})
})

it('should get delete the document from the model\'s sources',  async() => {
	const store = new MemStore({
		users: [
			{
				id: 1,
				username: 'jdoe',
				name: {
					first: 'John',
					last: 'Doe'
				}
			}
		],
		userMeta: [
			{
				id: 1,
				user: 1,
				meta: { active: true }
			}
		]
	})
	const UsersSchema = new Schema(store, 'users')
	const UserMetaSchema = new Schema(store, 'userMeta')

	const User = Model
		.create()
		.addBoundSource('user', UsersSchema)
		.describe({
			id: {
				type: Number,
				data: ({ user }) => user.id
			},
			username: {
				type: String,
				data: ({ user }) => user.username
			},
			name: {
				type: {
					first: String,
					last: String
				},
				data: ({ user }) => user.name
			}
		})
		.addQuery('default',
			Query
				.create()
				.input(id => ({ user: { id } }))
				.populate('user', ({ user }) => ({ id: user.id }))
		)

	const UserModelSchema = new ModelSchema(User, 'default')

	const UserMeta = Model
		.create()
		.addBoundSource('meta', UserMetaSchema)
		.addBoundSource('user', UserModelSchema)
		.describe({
			user: {
				type: UserModelSchema.type,
				data: ({ user }) => user
			},
			meta: {
				data: ({ meta }) => meta.meta
			}
		})
		.addQuery('default',
			Query
				.create()
				.input(id => ({ meta: { user: id } }))
				.populate('meta', ({ meta }) => ({ user: meta.user }))
				.populate('user', ({ meta }) => meta.user)
		)

	const doc = await UserMeta.get(1)
	expect(doc instanceof Document).toBeTruthy()
	expect(doc.data).toEqual({
		user: {
			id: 1,
			username: 'jdoe',
			name: { first: 'John', last: 'Doe' }
		},
		meta: { active: true }
	})

	const data = await doc.del()
	expect(store._data.users.length).toBe(0)
})
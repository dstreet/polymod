/* eslint-env jest */
const { Query } = require('./query')
const Model = require('./model')
const Document = require('./document')
const MemStore = require('../src/mem-store')
const Source = require('./mem-source')

test(`
Mutation with result
---
When performing a named mutation, each mutation source should be transformed
using the 'result' function defined by the mutation source.
`,
async () => {
	const store = new MemStore({
		posts: [
			{
				id: 1,
				title: 'Post 1',
				content: 'This is the first post',
				author: 1,
				tags: [1]
			},
			{
				id: 2,
				title: 'Post 2',
				content: 'This is the second post',
				author: 1,
				tags: [1, 2]
			}
		]
	})

	const Posts = new Source(store, 'posts')

	const query = new Query()
	query
		.addPopulation({
			name: 'post',
			operation: 'read',
			selector: ({ input }) => ({ id: input })
		})
		.setInputConstructor(({ post }) => post.id)

	const model = new Model()
	model
		.addSource('post', Posts)
		.addQuery('default', query)
		.addMutation('updateTitle', [
			{
				source: 'post',
				operations: (input, { post }) => ([
					{
						name: 'update',
						selector: { id: post.id },
						data: { title: input }
					}
				]),
				result: ([ post ]) => post
			}
		])

	let res = await model.get(1)
	expect(res).toBeInstanceOf(Document)
	
	let [ doc ] = await res.mutate('updateTitle', 'testing mutation')
	expect(doc.data).toEqual({
		post: {
			id: 1,
			title: 'testing mutation',
			content: 'This is the first post',
			author: 1,
			tags: [1]
		},
		input: 1
	})
})

test(`
Mutation without result
---
When performing a named mutation, each mutation source should be fetched after
the mutation is complete when there is no 'result' function defined by the
mutation source.
`,
async () => {
	const store = new MemStore({
		posts: [
			{
				id: 1,
				title: 'Post 1',
				content: 'This is the first post',
				author: 1,
				tags: [1]
			},
			{
				id: 2,
				title: 'Post 2',
				content: 'This is the second post',
				author: 1,
				tags: [1, 2]
			}
		]
	})

	const Posts = new Source(store, 'posts')

	const query = new Query()
	query
		.addPopulation({
			name: 'post',
			operation: 'read',
			selector: ({ input }) => ({ id: input })
		})
		.setInputConstructor(({ post }) => post.id)

	const model = new Model()
	model
		.addSource('post', Posts)
		.addQuery('default', query)
		.addMutation('updateTitle', [
			{
				source: 'post',
				operations: (input, { post }) => ([
					{
						name: 'update',
						selector: { id: post.id },
						data: { title: input }
					}
				])
			}
		])

	let res = await model.get(1)
	expect(res).toBeInstanceOf(Document)
	
	let [ doc ] = await res.mutate('updateTitle', 'testing mutation')
	expect(doc.data).toEqual({
		post: {
			id: 1,
			title: 'testing mutation',
			content: 'This is the first post',
			author: 1,
			tags: [1]
		},
		input: 1
	})
})

test(`
Multiple mutations
---
When Document method 'mutate' is called with an object, each property is mapped
to a defined mutation and a new Document is returned with the reflected mutations.
`,
async () => {
	const store = new MemStore({
		users: [
			{
				id: 1,
				username: 'jdoe',
				name: { first: 'John', last: 'Doe' },
			},
			{
				id: 2,
				username: 'twaits',
				name: { first: 'Tom', last: 'Waits' },
			}
		],
		tags: [
			{
				id: 1,
				title: 'foo'
			},
			{
				id: 2,
				title: 'bar'
			}
		],
		posts: [
			{
				id: 1,
				title: 'Post 1',
				content: 'This is the first post',
				author: 1,
				tags: [1]
			},
			{
				id: 2,
				title: 'Post 2',
				content: 'This is the second post',
				author: 1,
				tags: [1, 2]
			}
		]
	})

	const Posts = new Source(store, 'posts')
	const Users = new Source(store, 'users')
	const Tags = new Source(store, 'tags')

	const populations = [
		{
			name: 'post',
			operation: 'read',
			selector: ({ input }) => ({ id: input })
		},
		{
			name: 'author',
			operation: 'read',
			require: ['post'],
			selector: ({ post }) => {
				return { id: post.author }
			}
		},
		{
			name: 'tags',
			operation: 'read',
			require: ['post'],
			selector: ({ post }) => post.tags.map(id => ({ id }))
		}
	]

	const query = new Query()
	populations.forEach(p => query.addPopulation(p))
	query.setInputConstructor(({ post }) => post.id)

	const model = new Model()
	model
		.addSource('post', Posts)
		.addSource('author', Users)
		.addSource('tags', Tags)
		.addQuery('default', query)
		.addMutation('title', [
			{
				source: 'post',
				operations: (input, { post }) => ([
					{
						name: 'update',
						selector: { id: post.id },
						data: { title: input }
					}
				]),
				results: ([ post ]) => post
			}
		])
		.addMutation('content', [
			{
				source: 'post',
				operations: (input, { post }) => ([
					{
						name: 'update',
						selector: { id: post.id },
						data: { content: input }
					}
				]),
				results: ([ post ]) => post
			}
		])
		.describe({
			id: {
				data: ({ post }) => post.id
			},
			title: {
				data: ({ post }) => post.title
			},
			content: {
				data: ({ post }) => post.content
			},
			author: {
				data: ({ author }) => ({
					username: author.username,
					name: author.name
				}),
			},
			tags: {
				data: ({ tags }) => tags.map(tag => ({ title: tag.title }))
			}
		})

	let res = await model.get(1)

	let [ doc ] = await res.mutate({
		title: 'Testing',
		content: 'This is only a test'
	})
	expect(doc).toBeInstanceOf(Document)
	expect(doc.data).toEqual({
		id: 1,
		title: 'Testing',
		content: 'This is only a test',
		author: {
			username: 'jdoe',
			name: { first: 'John', last: 'Doe' }
		},
		tags: [
			{ title: 'foo' }
		]
	})
})

test(`
Removing
---
When calling the 'remove' method, all bound sources should be removed
`,
async() => {
	const store = new MemStore({
		posts: [
			{
				id: 1,
				title: 'Post 1',
				content: 'This is the first post',
				author: 1,
				tags: [1]
			},
			{
				id: 2,
				title: 'Post 2',
				content: 'This is the second post',
				author: 1,
				tags: [1, 2]
			}
		]
	})

	const Posts = new Source(store, 'posts')

	const query = new Query()
	query
		.addPopulation({
			name: 'post',
			operation: 'read',
			selector: ({ input }) => ({ id: input })
		})
		.setInputConstructor(({ post }) => post.id)

	const model = new Model()
	model
		.addSource('post', Posts)
		.addQuery('default', query)
		.setRemove([
			{
				source: 'post',
				operations: ({ input }) => ([
					{
						name: 'remove',
						selector: { id: input }
					}
				])
			}
		])

	let res = await model.get(1)
	expect(res).toBeInstanceOf(Document)
	
	await res.remove()
	expect(store._data.posts).toHaveLength(1)
})

test(`
Removing result
---
When removing a document, an object should be returned with properties for each
mutated source, and values containing the results from each mutation operation.
`,
async() => {
	const store = new MemStore({
		posts: [
			{
				id: 1,
				title: 'Post 1',
				content: 'This is the first post',
				author: 1,
				tags: [1]
			},
			{
				id: 2,
				title: 'Post 2',
				content: 'This is the second post',
				author: 1,
				tags: [1, 2]
			}
		]
	})

	const Posts = new Source(store, 'posts')

	const query = new Query()
	query
		.addPopulation({
			name: 'post',
			operation: 'read',
			selector: ({ input }) => ({ id: input })
		})
		.setInputConstructor(({ post }) => post.id)

	const model = new Model()
	model
		.addSource('post', Posts)
		.addQuery('default', query)
		.setRemove([
			{
				source: 'post',
				operations: ({ input }) => ([
					{
						name: 'remove',
						selector: { id: input }
					}
				])
			}
		])

	let res = await model.get(1)
	expect(res).toBeInstanceOf(Document)
	
	res = await res.remove()
	expect(res).toEqual({
		post: [
			{
				id: 1,
				title: 'Post 1',
				content: 'This is the first post',
				author: 1,
				tags: [1]
			}
		]
	})
})

test(`
Cannot remove an already removed document
---
When attempting to remove an already removed document. An error should be thrown.
`,
async() => {
	const store = new MemStore({
		posts: [
			{
				id: 1,
				title: 'Post 1',
				content: 'This is the first post',
				author: 1,
				tags: [1]
			},
			{
				id: 2,
				title: 'Post 2',
				content: 'This is the second post',
				author: 1,
				tags: [1, 2]
			}
		]
	})

	const Posts = new Source(store, 'posts')

	const query = new Query()
	query
		.addPopulation({
			name: 'post',
			operation: 'read',
			selector: ({ input }) => ({ id: input })
		})
		.setInputConstructor(({ post }) => post.id)

	const model = new Model()
	model
		.addSource('post', Posts)
		.addQuery('default', query)
		.setRemove([
			{
				source: 'post',
				operations: ({ input }) => ([
					{
						name: 'remove',
						selector: { id: input }
					}
				])
			}
		])

	let res = await model.get(1)
	expect(res).toBeInstanceOf(Document)
	
	await res.remove()
	expect(res.remove()).rejects.toBeInstanceOf(Error)
})

test(`
Cannot mutate removed document
---
When attempting to mutate a removed document. An error should be thrown.
`,
async() => {
	const store = new MemStore({
		posts: [
			{
				id: 1,
				title: 'Post 1',
				content: 'This is the first post',
				author: 1,
				tags: [1]
			},
			{
				id: 2,
				title: 'Post 2',
				content: 'This is the second post',
				author: 1,
				tags: [1, 2]
			}
		]
	})

	const Posts = new Source(store, 'posts')

	const query = new Query()
	query
		.addPopulation({
			name: 'post',
			operation: 'read',
			selector: ({ input }) => ({ id: input })
		})
		.setInputConstructor(({ post }) => post.id)

	const model = new Model()
	model
		.addSource('post', Posts)
		.addQuery('default', query)
		.setRemove([
			{
				source: 'post',
				operations: ({ input }) => ([
					{
						name: 'remove',
						selector: { id: input }
					}
				])
			}
		])

	let res = await model.get(1)
	expect(res).toBeInstanceOf(Document)
	
	await res.remove()
	expect(res.mutate()).rejects.toBeInstanceOf(Error)
})

test(`
Validate on mutate
---
When mutating a document, the input should be validated against the mutation
type or the model descriptor. An error should be returned when input does not
validate
`,
async () => {
	const store = new MemStore({
		users: [
			{
				id: 1,
				username: 'jdoe',
				name: { first: 'John', last: 'Doe' },
			},
			{
				id: 2,
				username: 'twaits',
				name: { first: 'Tom', last: 'Waits' },
			}
		],
		tags: [
			{
				id: 1,
				title: 'foo'
			},
			{
				id: 2,
				title: 'bar'
			}
		],
		posts: [
			{
				id: 1,
				title: 'Post 1',
				content: 'This is the first post',
				author: 1,
				tags: [1]
			},
			{
				id: 2,
				title: 'Post 2',
				content: 'This is the second post',
				author: 1,
				tags: [1, 2]
			}
		]
	})

	const Posts = new Source(store, 'posts')
	const Users = new Source(store, 'users')
	const Tags = new Source(store, 'tags')

	const populations = [
		{
			name: 'post',
			operation: 'read',
			selector: ({ input }) => ({ id: input })
		},
		{
			name: 'author',
			operation: 'read',
			require: ['post'],
			selector: ({ post }) => {
				return { id: post.author }
			}
		},
		{
			name: 'tags',
			operation: 'read',
			require: ['post'],
			selector: ({ post }) => post.tags.map(id => ({ id }))
		}
	]

	const query = new Query()
	populations.forEach(p => query.addPopulation(p))
	query.setInputConstructor(({ post }) => post.id)

	const model = new Model()
	model
		.addSource('post', Posts)
		.addSource('author', Users)
		.addSource('tags', Tags)
		.addQuery('default', query)
		.addMutation('author', [
			{
				source: 'post',
				operations: (input, { post }) => ([
					{
						name: 'update',
						selector: { id: post.id },
						data: { author: input }
					}
				]),
				results: ([ post ]) => post
			}
		], Number)
		.describe({
			id: {
				type: Number,
				data: ({ post }) => post.id
			},
			title: {
				type: String,
				data: ({ post }) => post.title
			},
			content: {
				type: String,
				data: ({ post }) => post.content
			},
			author: {
				type: {
					username: String,
					name: { first: String, last: String }
				},
				data: ({ author }) => ({
					username: author.username,
					name: author.name
				}),
			},
			tags: {
				type: [{ title: String }],
				data: ({ tags }) => tags.map(tag => ({ title: tag.title }))
			}
		})

	let res = await model.get(1)

	let [ doc, error ] = await res.mutate('author', 'bob')

	expect(error.err).toBeInstanceOf(Error)

	let [ doc2, error2 ] = await res.mutate({
		author: 'bob'
	})

	expect(error2.err).toBeInstanceOf(Error)
})

test(`
Apply defaults on mutate
---
When mutating document, default values defined in the data structure should be
used when not explictly set
`,
async () => {
	const store = new MemStore({
		users: [
			{
				id: 1,
				username: 'jdoe',
				name: { first: 'John', last: 'Doe' },
			},
			{
				id: 2,
				username: 'twaits',
				name: { first: 'Tom', last: 'Waits' },
			}
		],
		tags: [
			{
				id: 1,
				title: 'foo'
			},
			{
				id: 2,
				title: 'bar'
			}
		],
		posts: [
			{
				id: 1,
				title: 'Post 1',
				content: 'This is the first post',
				author: 1,
				tags: [1]
			},
			{
				id: 2,
				title: 'Post 2',
				content: 'This is the second post',
				author: 1,
				tags: [1, 2]
			}
		]
	})

	const Posts = new Source(store, 'posts')
	const Users = new Source(store, 'users')
	const Tags = new Source(store, 'tags')

	const populations = [
		{
			name: 'post',
			operation: 'read',
			selector: ({ input }) => ({ id: input })
		},
		{
			name: 'author',
			operation: 'read',
			require: ['post'],
			selector: ({ post }) => {
				return { id: post.author }
			}
		},
		{
			name: 'tags',
			operation: 'read',
			require: ['post'],
			selector: ({ post }) => post.tags.map(id => ({ id }))
		}
	]

	const query = new Query()
	populations.forEach(p => query.addPopulation(p))
	query.setInputConstructor(({ post }) => post.id)

	const now = new Date()

	const model = new Model()
	model
		.addSource('post', Posts)
		.addSource('author', Users)
		.addSource('tags', Tags)
		.addQuery('default', query)
		.addMutation('title', [
			{
				source: 'post',
				operations: (input, { post }) => ([
					{
						name: 'update',
						selector: { id: post.id },
						data: { title: input }
					}
				]),
				results: ([ post ]) => post
			}
		])
		.addMutation('dateUpdated', [
			{
				source: 'post',
				operations: (input, { post }) => ([
					{
						name: 'update',
						selector: { id: post.id },
						data: { dateUpdated: input }
					}
				]),
				results: ([ post ]) => post
			}
		])
		.describe({
			id: {
				data: ({ post }) => post.id
			},
			title: {
				data: ({ post }) => post.title
			},
			content: {
				data: ({ post }) => post.content
			},
			author: {
				data: ({ author }) => ({
					username: author.username,
					name: author.name
				})
			},
			tags: {
				data: ({ tags }) => tags.map(tag => ({ title: tag.title }))
			},
			dateUpdated: {
				data: ({ post }) => post.dateUpdated,
				default: () => now
			}
		})

	let res = await model.get(1)

	let [ doc ] = await res.mutate('title', 'Updated post')

	expect(doc).toBeInstanceOf(Document)
	expect(doc.data).toEqual({
		id: 1,
		title: 'Updated post',
		content: 'This is the first post',
		author: {
			username: 'jdoe',
			name: { first: 'John', last: 'Doe' }
		},
		dateUpdated: now,
		tags: [{ title: 'foo' }]
	})
})
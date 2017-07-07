/* eslint-env jest */
const { Query } = require('./query')
const Model = require('./model')
const Document = require('./document')
const MemStore = require('../src/mem-store')
const Source = require('./mem-source')

test(`
Get from single source
---
When a single source is provided, the 'get' method should return a document with the
data retrieved from the source using the 'default' query.
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

	let res = await model.get(1)

	expect(res).toBeInstanceOf(Document)
	expect(res.data).toEqual({
		post: {
			id: 1,
			title: 'Post 1',
			content: 'This is the first post',
			author: 1,
			tags: [1]
		},
		input: 1
	})
})

test(`
Get from multiple sources
---
When multiple sources are provided, the 'get' method should return a document
with the data retrieved from the sources using the 'default' query.
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

	const model = new Model()
	model
		.addSource('post', Posts)
		.addSource('author', Users)
		.addSource('tags', Tags)
		.addQuery('default', query)

	let res = await model.get(1)
	
	expect(res).toBeInstanceOf(Document)
	expect(res.data).toEqual({
		post: {
			id: 1,
			title: 'Post 1',
			content: 'This is the first post',
			author: 1,
			tags: [1]
		},
		author: {
			id: 1,
			username: 'jdoe',
			name: { first: 'John', last: 'Doe' },
		},
		tags: [{
			id: 1,
			title: 'foo'
		}],
		input: 1
	})

	res = await model.query('default', 2)

	expect(res).toBeInstanceOf(Document)
	expect(res.data).toEqual({
		post: {
			id: 2,
			title: 'Post 2',
			content: 'This is the second post',
			author: 1,
			tags: [1, 2]
		},
		author: {
			id: 1,
			username: 'jdoe',
			name: { first: 'John', last: 'Doe' },
		},
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
		input: 2
	})

})

test(`
Describe data structure
---
When calling 'describe' with an object, the source data will be mapped to each
of the object properties using their 'data' functions.
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

	const model = new Model()
	model
		.addSource('post', Posts)
		.addSource('author', Users)
		.addSource('tags', Tags)
		.addQuery('default', query)
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
	
	expect(res).toBeInstanceOf(Document)
	expect(res.data).toEqual({
		id: 1,
		title: 'Post 1',
		content: 'This is the first post',
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
Creating a document
---
When 'create' is called, a new Document is created with the initial data.
`,
async () => {
	const store = new MemStore({
		users: [
			{
				id: 1,
				username: 'jdoe',
				name: { first: 'John', last: 'Doe' },
			},
		],
		tags: [
			{
				id: 1,
				title: 'foo'
			}
		],
		posts: [
			{
				id: 1,
				title: 'Post 1',
				content: 'This is the first post',
				author: 1,
				tags: [1]
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
		.setInitializer([
			{
				source: 'post',
				operations: input => ([
					{
						name: 'create',
						data: input
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

	let [ res ] = await model.create({
		id: 2,
		title: 'This is a new post',
		content: 'Hey. Look at me!',
		author: 1,
		tags: [1]
	})

	expect(res).toBeInstanceOf(Document)
	expect(res.data).toEqual({
		id: 2,
		title: 'This is a new post',
		content: 'Hey. Look at me!',
		author: {
			username: 'jdoe',
			name: { first: 'John', last: 'Doe' }
		},
		tags: [{ title: 'foo' }]
	})
})

test(`
Model as source
---
A model can use another model as a source
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
	})

	const Posts = new Source(store, 'posts')
	const Tags = new Source(store, 'tags')

	const TagModel = new Model()
	TagModel
		.addSource('tag', Tags)
		.addQuery('default',
			(new Query())
				.addPopulation({
					name: 'tag',
					operation: 'read',
					selector: ({ input }) => ({ id: input })
				})
				.setInputConstructor(({ tag }) => tag.id)
		)

	const PostModel = new Model()
	PostModel
		.addSource('post', Posts)
		.addSource('tags', TagModel)
		.addQuery('default',
			(new Query())
				.addPopulation({
					name: 'post',
					operation: 'read',
					selector: ({ input }) => ({ id: input })
				})
				.addPopulation({
					name: 'tags',
					operation: 'default',
					selector: ({ post }) => post.tags.map(id => id)
				})
				.setInputConstructor(({ post }) => post.id)
		)

	let res = await PostModel.get(1)

	expect(res).toBeInstanceOf(Document)
	expect(res.data).toHaveProperty('post', {
		id: 1,
		title: 'Post 1',
		content: 'This is the first post',
		author: 1,
		tags: [1]
	})
	expect(res.data.tags).toHaveLength(1)
	expect(res.data.tags[0]).toBeInstanceOf(Document)
	expect(res.data.tags[0].data).toEqual({
		tag: {
			id: 1,
			title: 'foo'
		},
		input: 1
	})
})

test(`
Mutating model source
---
When using a model as a source, mutations should carry through to that model
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
		],
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
		]
	})

	const Posts = new Source(store, 'posts')
	const Users = new Source(store, 'users')

	const UserModel = new Model()
	UserModel
		.addSource('user', Users)
		.addQuery('default',
			(new Query())
				.addPopulation({
					name: 'user',
					operation: 'read',
					selector: ({ input }) => ({ id: input })
				})
				.setInputConstructor(({ user }) => user.id)
		)
		.addMutation('updateUsername', [
			{
				source: 'user',
				operations: (input, { user }) => ([
					{
						name: 'update',
						selector: { id: user.id },
						data: { username: input }
					}
				]),
				result: ([ user ]) => user
			}
		])

	const PostModel = new Model()
	PostModel
		.addSource('post', Posts)
		.addSource('author', UserModel)
		.addQuery('default',
			(new Query())
				.addPopulation({
					name: 'post',
					operation: 'read',
					selector: ({ input }) => ({ id: input })
				})
				.addPopulation({
					name: 'author',
					operation: 'default',
					selector: ({ post }) => post.author
				})
				.setInputConstructor(({ post }) => post.id)
		)
		.addMutation('updateAuthorUsername', [
			{
				source: 'author',
				operations: (input, { author }) => ([
					{
						name: 'updateUsername',
						selector: author,
						data: input
					}
				]),
				result: ([ author ]) => author
			}
		])

	let res = await PostModel.get(1)

	expect(res).toBeInstanceOf(Document)
	expect(res.data).toHaveProperty('post', {
		id: 1,
		title: 'Post 1',
		content: 'This is the first post',
		author: 1,
		tags: [1]
	})
	expect(res.data.author).toBeInstanceOf(Document)
	expect(res.data.author.data).toEqual({
		user: {
			id: 1,
			username: 'jdoe',
			name: { first: 'John', last: 'Doe' },
		},
		input: 1
	})

	let [ doc ] = await res.mutate('updateAuthorUsername', 'foobar')

	expect(doc).toBeInstanceOf(Document)
	expect(doc.data).toHaveProperty('post', {
		id: 1,
		title: 'Post 1',
		content: 'This is the first post',
		author: 1,
		tags: [1]
	})
	expect(doc.data.author).toBeInstanceOf(Document)
	expect(doc.data.author.data).toEqual({
		user: {
			id: 1,
			username: 'foobar',
			name: { first: 'John', last: 'Doe' },
		},
		input: 1
	})

	doc = await UserModel.get(1)
	expect(doc.data).toEqual({
		user: {
			id: 1,
			username: 'foobar',
			name: { first: 'John', last: 'Doe' },
		},
		input: 1
	})
})

test(`
Creating a document with a model source
---
When creating a new document, an affected model source should call
its initializer
`,
async () => {
	const store = new MemStore({
		posts: [
			{
				id: 1,
				title: 'Post 1',
				content: 'This is the first post',
				author: 1,
			}
		],
		tagLinks: [
			{ id: 1, post: 1, tags: [1, 2] }
		]
	})

	const Posts = new Source(store, 'posts')
	const TagLinks = new Source(store, 'tagLinks')

	const TagLinkModel = new Model()
	TagLinkModel
		.addSource('link', TagLinks)
		.addQuery('default',
			(new Query())
				.addPopulation({
					name: 'link',
					operation: 'read',
					selector: ({ input }) => ({ post: input })
				})
				.setInputConstructor(({ link }) => link.post)
		)
		.setInitializer([
			{
				source: 'link',
				operations: input => ([
					{
						name: 'create',
						data: input
					}
				]),
				results: ([ link ]) => link
			}
		])

	const PostModel = new Model()
	PostModel
		.addSource('post', Posts)
		.addSource('tagLink', TagLinkModel)
		.addQuery('default',
			(new Query())
				.addPopulation({
					name: 'post',
					operation: 'read',
					selector: ({ input }) => ({ id: input })
				})
				.addPopulation({
					name: 'tagLink',
					operation: 'default',
					require: ['post'],
					selector: ({ post }) => post.id
				})
				.setInputConstructor(({ post }) => post.id)
		)
		.setInitializer([
			{
				source: 'post',
				operations: ({ id, title, content, author}) => ([
					{
						name: 'create',
						data: { id, title, content, author }
					}
				]),
				results: ([ post ]) => post
			},
			{
				source: 'tagLink',
				operations: ({ tags }, { post }) => ([
					{
						name: 'create',
						data: { post: post.id, tags }
					}
				]),
				results: ([ link ]) => link
			}
		])

	let res = await PostModel.get(1)

	expect(res).toBeInstanceOf(Document)
	expect(res.data).toHaveProperty('post', {
		id: 1,
		title: 'Post 1',
		content: 'This is the first post',
		author: 1
	})
	expect(res.data.tagLink).toBeInstanceOf(Document)
	expect(res.data.tagLink.data).toEqual({
		link: { id: 1, post: 1, tags: [1, 2] },
		input: 1
	})

	let [ doc ] = await PostModel.create({
		id: 2,
		title: 'This is a test',
		content: 'Woooo',
		author: 1,
		tags: [2, 3]
	})

	expect(doc).toBeInstanceOf(Document)
	expect(doc.data).toHaveProperty('post', {
		id: 2,
		title: 'This is a test',
		content: 'Woooo',
		author: 1,
	})
	expect(doc.data.tagLink).toBeInstanceOf(Document)
	expect(doc.data.tagLink.data).toHaveProperty('link.post', 2)
	expect(doc.data.tagLink.data).toHaveProperty('link.tags', [2, 3])
	expect(doc.data.tagLink.data).toHaveProperty('input', 2)
})

test(`
Query for multiple documents
---
When performing a query that returns more than one result, multiple documents
should be returned
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
		posts: [
			{
				id: 1,
				title: 'Post 1',
				content: 'This is the first post',
				author: 1
			},
			{
				id: 2,
				title: 'Post 2',
				content: 'This is the second post',
				author: 1
			},
			{
				id: 3,
				title: 'Post 3',
				content: 'This is the third post',
				author: 2
			}
		]
	})

	const Posts = new Source(store, 'posts')
	const Users = new Source(store, 'users')

	const model = new Model()
	model
		.addSource('post', Posts)
		.addSource('author', Users)
		.addQuery('default',
			(new Query())
				.addPopulation({
					name: 'post',
					operation: 'read',
					selector: ({ input }) => ({ id: input })
				})
				.addPopulation({
					name: 'author',
					operation: 'read',
					require: ['post'],
					selector: ({ post }) => ({ id: post.author })
				})
				.setInputConstructor(({ post }) => post.id)
		)
		.addQuery('getByAuthor',
			(new Query())
				.addPopulation({
					name: 'post',
					operation: 'readMany',
					selector: ({ input }) => ({ author: input })
				})
				.addPopulation({
					name: 'author',
					operation: 'read',
					selector: ({ input }) => ({ id: input })
				})
				.mapDocument(({ post, author }) => post.map(p => {
					return {
						post: p,
						author
					}
				}))
		)

	let res = await model.query('getByAuthor', 1)
	
	expect(res).toHaveLength(2)
	expect(res[0]).toBeInstanceOf(Document)
	expect(res[0].data).toEqual({
		post: {
			id: 1,
			title: 'Post 1',
			content: 'This is the first post',
			author: 1
		},
		author: {
			id: 1,
			username: 'jdoe',
			name: { first: 'John', last: 'Doe' },
		},
		input: 1
	})
	expect(res[1].data).toEqual({
		post: {
			id: 2,
			title: 'Post 2',
			content: 'This is the second post',
			author: 1
		},
		author: {
			id: 1,
			username: 'jdoe',
			name: { first: 'John', last: 'Doe' },
		},
		input: 2
	})

})

test(`
Describing types
---
The document description should allow types to be defined for each property.
When calling 'describe' with no paramters, this type structure should be returned.
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

	const model = new Model()
	model
		.addSource('post', Posts)
		.addSource('author', Users)
		.addSource('tags', Tags)
		.addQuery('default', query)
		.describe({
			id: {
				type: Number,
				data: ({ post }) => post.id
			},
			title: {
				type: String,
				required: true,
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
				type: [String],
				data: ({ tags }) => tags.map(tag => ({ title: tag.title }))
			}
		})

	expect(model.describe()).toEqual({
		id: { type: Number },
		title: { type: String, required: true },
		content: { type: String },
		author: {
			type: {
				username: String,
				name: { first: String, last: String }
			}
		},
		tags: { type: [String] }
	})
})

test(`
Validate on create
---
When creating a new document for a model where data types are defined, if the
input data does not match, an error should be returned
`,
async () => {
	const store = new MemStore({
		users: [
			{
				id: 1,
				username: 'jdoe',
				name: { first: 'John', last: 'Doe' },
			},
		],
		tags: [
			{
				id: 1,
				title: 'foo'
			}
		],
		posts: [
			{
				id: 1,
				title: 'Post 1',
				content: 'This is the first post',
				author: 1,
				tags: [1]
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
		.setInitializer([
			{
				source: 'post',
				operations: input => ([
					{
						name: 'create',
						data: input
					}
				]),
				results: ([ post ]) => post
			}
		], {
			author: Number,
			tags: [Number]
		})
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

	let [ doc, error ] = await model.create({
		id: 2,
		title: 'This is a new post',
		content: 'Hey. Look at me!',
		author: 'John',
		tags: [1]
	})

	expect(error.err).toBeInstanceOf(Error)
})

test(`
Default values
---
When creating a new document, default values defined in the data structure
should be used when not explictly set
`,
async () => {
	const store = new MemStore({
		users: [
			{
				id: 1,
				username: 'jdoe',
				name: { first: 'John', last: 'Doe' },
			},
		],
		tags: [
			{
				id: 1,
				title: 'foo'
			}
		],
		posts: [
			{
				id: 1,
				title: 'Post 1',
				content: 'This is the first post',
				author: 1,
				tags: [1]
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
		.setInitializer([
			{
				source: 'post',
				operations: input => ([
					{
						name: 'create',
						data: input
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
				data: ({ post }) => post.title,
				default: () => 'New Post'
			},
			content: {
				data: ({ post }) => post.content
			},
			author: {
				data: ({ author }) => ({
					username: author.username,
					name: author.name
				}),
				default: () => 1
			},
			tags: {
				data: ({ tags }) => tags.map(tag => ({ title: tag.title }))
			}
		})

	let [ res ] = await model.create({
		id: 2,
		content: 'Hey. Look at me!',
		tags: [1]
	})

	expect(res).toBeInstanceOf(Document)
	expect(res.data).toEqual({
		id: 2,
		title: 'New Post',
		content: 'Hey. Look at me!',
		author: {
			username: 'jdoe',
			name: { first: 'John', last: 'Doe' }
		},
		tags: [{ title: 'foo' }]
	})
})

test(`
Write-only properties
---
Properties with no data function should not be returned with the document data
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

	const populations = [
		{
			name: 'post',
			operation: 'read',
			selector: ({ input }) => ({ id: input })
		}
	]

	const query = new Query()
	populations.forEach(p => query.addPopulation(p))

	const model = new Model()
	model
		.addSource('post', Posts)
		.addQuery('default', query)
		.describe({
			id: {},
			title: {
				data: ({ post }) => post.title
			},
			content: {
				data: ({ post }) => post.content
			}
		})

	let res = await model.get(1)
	
	expect(res).toBeInstanceOf(Document)
	expect(res.data).toEqual({
		title: 'Post 1',
		content: 'This is the first post',
	})
	expect(res.data.id).toBeUndefined()
})
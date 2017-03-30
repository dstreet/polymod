/* eslint-env jest */
const Model = require('./model')
const Schema = require('./schema')
const Document = require('./document')
const Query = require('./query')
const MemStore = require('../src/mem-store')

const now = new Date()

describe('single source', async () => {
	test('get()', async () => {
		const storage = new MemStore({
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				},
				{
					id: 2,
					title: 'Post 2',
					content: 'This is the second post',
					dateCreated: now
				}
			]
		})
		const PostsSchema = new Schema(storage, 'posts', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.describe({
				title: {
					type: String,
					data: ({ post }) => post.title
				},
				content: {
					type: String,
					data: ({ post }) => post.content
				},
				date: {
					type: {
						created: Date	
					},
					data: ({ post }) => ({
						created: post.dateCreated
					})
				}
			})
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
			)

		const doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now }
		})
	})

	test('mutate() - unnamed', async () => {
		const storage = new MemStore({
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				},
				{
					id: 2,
					title: 'Post 2',
					content: 'This is the second post',
					dateCreated: now
				}
			]
		})
		const PostsSchema = new Schema(storage, 'posts', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.describe({
				title: {
					type: String,
					data: ({ post }) => post.title,
					mutation: {
						method: { source: 'post', data: title => ({ title }) }
					}
				},
				content: {
					type: String,
					data: ({ post }) => post.content,
					mutation: {
						method: [{ source: 'post', data: content => ({ content }) }]
					}
				},
				date: {
					type: { created: Date },
					data: ({ post }) => ({
						created: post.dateCreated
					})
				}
			})
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
			)

		let doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now }
		})

		doc = await doc.mutate({
			title: 'Updated Title',
			content: 'This is the first post'
		})
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Updated Title',
			content: 'This is the first post',
			date: { created: now }
		})
	})

	test('mutate() - named', async () => {
		const storage = new MemStore({
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				},
				{
					id: 2,
					title: 'Post 2',
					content: 'This is the second post',
					dateCreated: now
				}
			]
		})
		const PostsSchema = new Schema(storage, 'posts', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.map(({ post }) => ({
				title: post.title,
				content: post.content,
				date: { created: post.dateCreated }
			}))
			.addMutation('updateTitle', [
				{ source: 'post', data: title => ({ title }) }
			])
			.addMutation('updateAll', [
				{ source: 'post', data: data => ({ title: data.title, content: data.content, dateCreated: data.date.created }) }
			])
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
			)

		let doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now }
		})

		doc = await doc.mutate('updateTitle', 'Updated Title')
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Updated Title',
			content: 'This is the first post',
			date: { created: now }
		})

		const now2 = new Date()
		doc = await doc.mutate('updateAll', {
			title: 'Updated Again',
			content: 'Look at me!',
			date: { created: now2 }
		})
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Updated Again',
			content: 'Look at me!',
			date: { created: now2 }
		})
	})

	test('del()', async () => {
		const storage = new MemStore({
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				},
				{
					id: 2,
					title: 'Post 2',
					content: 'This is the second post',
					dateCreated: now
				}
			]
		})
		const PostsSchema = new Schema(storage, 'posts', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.map(({ post }) => ({
				title: post.title,
				content: post.content,
				date: { created: post.dateCreated }
			}))
			.bindSources(['post'])
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
			)

		let doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now }
		})

		let deleted = await Post.del(1)
		expect(deleted).toEqual([
			{
				source: 'post',
				deleted: [{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				}]
			}
		])
	})

	test('createNew()', async () => {
		const storage = new MemStore({
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				},
				{
					id: 2,
					title: 'Post 2',
					content: 'This is the second post',
					dateCreated: now
				}
			]
		})
		const PostsSchema = new Schema(storage, 'posts', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.describe({
				title: {
					type: String,
					data: ({ post }) => post.title,
					mutation: {
						method: { source: 'post', data: title => ({ title }) }
					}
				},
				content: {
					type: String,
					data: ({ post }) => post.content,
					mutation: {
						method: { source: 'post', data: content => ({ content }) }
					}
				},
				date: {
					type: {
						created: Date	
					},
					data: ({ post }) => ({
						created: post.dateCreated
					}),
					mutation: {
						method: { source: 'post', data: date => ({ dateCreated: date.created }) }
					},
					default: () => ({ created: now })
				}
			})
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}), ({ post }) => post.id)
					.populate('post', ({ post }) => ({ id: post.id }))
			)

		let doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now }
		})
		
		doc = await Post.create({
			title: 'New Post',
			content: 'New post content'
		})
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toHaveProperty('title', 'New Post')
		expect(doc.data).toHaveProperty('content', 'New post content')
		expect(doc.data).toHaveProperty('date.created', now)
	})

	test('query()', async () => {
		const storage = new MemStore({
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				},
				{
					id: 2,
					title: 'Post 2',
					content: 'This is the second post',
					dateCreated: now
				}
			]
		})
		const PostsSchema = new Schema(storage, 'posts', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.map(({ post }) => ({
				title: post.title,
				content: post.content,
				date: { created: post.dateCreated }
			}))
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id } }))
					.populate('post', ({ post }) => ({ id: post.id }))
			)

		const doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now }
		})
	})

	test('describe()', async () => {
		const storage = new MemStore()
		const PostsSchema = new Schema(storage, 'posts', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.describe({
				title: {
					type: String,
					data: ({ post }) => post.title,
					mutation: {
						method: { source: 'post', data: title => ({ title }) }
					}
				},
				content: {
					type: String,
					meta: {
						label: 'Content',
						description: 'Post content'
					},
					data: ({ post }) => post.content
				},
				date: {
					type: {
						created: Date	
					},
					data: ({ post }) => ({
						created: post.dateCreated
					})
				}
			})
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
			)

		expect(Post.describe()).toEqual({
			title: {
				type: String,
				mutable: true
			},
			content: {
				type: String,
				meta: {
					label: 'Content',
					description: 'Post content'
				},
				mutable: false
			},
			date: {
				type: { created: Date },
				mutable: false
			}
		})
	})
})

describe('multiple sources', async () => {
	test('get()', async () => {
		const storage = new MemStore({
			users: [
				{
					id: 1,
					username: 'jdoe',
					name: { first: 'John', last: 'Doe' },
					dateCreated: now
				},
				{
					id: 2,
					username: 'twaits',
					name: { first: 'Tom', last: 'Waits' },
					dateCreated: now
				}
			],
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now,
					author: 1
				},
				{
					id: 2,
					title: 'Post 2',
					content: 'This is the second post',
					dateCreated: now,
					author: 1
				}
			]
		})

		const PostsSchema = new Schema(storage, 'posts', 'id')
		const UsersSchema = new Schema(storage, 'users', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.addSource('author', UsersSchema)
			.map(({ post, author }) => ({
				title: post.title,
				content: post.content,
				date: { created: post.dateCreated },
				author: {
					username: author.username,
					name: author.name
				}
			}))
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
					.populate('author', ({ post }) => ({ id: post.author }))
			)
			
		const doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now },
			author: {
				username: 'jdoe',
				name: { first: 'John', last: 'Doe' }
			}
		})
	})

	test('mutate()', async () => {
		const storage = new MemStore({
			users: [
				{
					id: 1,
					username: 'jdoe',
					name: { first: 'John', last: 'Doe' },
					dateCreated: now
				},
				{
					id: 2,
					username: 'twaits',
					name: { first: 'Tom', last: 'Waits' },
					dateCreated: now
				}
			],
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now,
					author: 1
				},
				{
					id: 2,
					title: 'Post 2',
					content: 'This is the second post',
					dateCreated: now,
					author: 1
				}
			]
		})

		const PostsSchema = new Schema(storage, 'posts', 'id')
		const UsersSchema = new Schema(storage, 'users', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.addSource('author', UsersSchema)
			.describe({
				title: {
					type: String,
					data: ({ post }) => post.title
				},
				content: {
					type: String,
					data: ({ post }) => post.content
				},
				date: {
					type: {
						created: { type: Date }
					},
					data: ({ post }) => ({
						created: post.dateCreated
					})
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
					mutation: {
						type: Number,
						method: { source: 'post', data: id => ({ author: id }) }
					}
				}
			})
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
					.populate('author', ({ post }) => ({ id: post.author }))
			)
			
		let doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now },
			author: {
				username: 'jdoe',
				name: { first: 'John', last: 'Doe' }
			}
		})

		doc = await doc.mutate({
			author: 2
		})
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now },
			author: {
				username: 'twaits',
				name: { first: 'Tom', last: 'Waits' }
			}
		})
	})

	test('del()', async () => {
		const storage = new MemStore({
			users: [
				{
					id: 1,
					username: 'jdoe',
					name: { first: 'John', last: 'Doe' },
					dateCreated: now
				},
				{
					id: 2,
					username: 'twaits',
					name: { first: 'Tom', last: 'Waits' },
					dateCreated: now
				}
			],
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now,
					author: 1
				},
				{
					id: 2,
					title: 'Post 2',
					content: 'This is the second post',
					dateCreated: now,
					author: 1
				}
			]
		})

		const PostsSchema = new Schema(storage, 'posts', 'id')
		const UsersSchema = new Schema(storage, 'users', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.addSource('author', UsersSchema)
			.map(({ post, author }) => ({
				title: post.title,
				content: post.content,
				date: { created: post.dateCreated },
				author: {
					username: author.username,
					name: author.name
				}
			}))
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
					.populate('author', ({ post }) => ({ id: post.author }))
			)
			.bindSources(['post'])
			
		const doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now },
			author: {
				username: 'jdoe',
				name: { first: 'John', last: 'Doe' }
			}
		})

		const deleted = await doc.del()
		expect(deleted).toEqual([
			{
				source: 'post',
				deleted: [{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now,
					author: 1
				}]
			}
		])
	})

	test('createNew()', async () => {
		const storage = new MemStore({
			users: [
				{
					id: 1,
					username: 'jdoe',
					name: { first: 'John', last: 'Doe' },
					dateCreated: now
				},
				{
					id: 2,
					username: 'twaits',
					name: { first: 'Tom', last: 'Waits' },
					dateCreated: now
				}
			],
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now,
					author: 1
				},
				{
					id: 2,
					title: 'Post 2',
					content: 'This is the second post',
					dateCreated: now,
					author: 1
				}
			]
		})

		const PostsSchema = new Schema(storage, 'posts', 'id')
		const UsersSchema = new Schema(storage, 'users', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.addSource('author', UsersSchema)
			.describe({
				title: {
					type: String,
					data: ({ post }) => post.title,
					mutation: {
						method: { source: 'post', data: title => ({ title }) }
					}
				},
				content: {
					type: String,
					data: ({ post }) => post.content,
					mutation: {
						method: { source: 'post', data: content => ({ content }) }
					}
				},
				date: {
					type: {
						created: Date	
					},
					data: ({ post }) => ({
						created: post.dateCreated
					}),
					mutation: {
						method: { source: 'post', data: date => ({ dateCreated: date.created }) }
					},
					default: () => ({ created: now })
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
					mutation: {
						type: Number,
						method: { source: 'post', data: id => ({ author: id }) }
					}
				}
			})
			.addQuery('default',
				Query
					.create()
					.input(
						id => ({ post: { id }}),
						({ post }) => post.id
					)
					.populate('post', ({ post }) => ({ id: post.id }))
					.populate('author', ({ post }) => ({ id: post.author }))
			)
			
		let doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now },
			author: {
				username: 'jdoe',
				name: { first: 'John', last: 'Doe' }
			}
		})

		doc = await Post.create({
			title: 'New Post',
			content: 'New post content',
			author: 2
		})
		expect(doc.data).toHaveProperty('title', 'New Post')
		expect(doc.data).toHaveProperty('content', 'New post content')
		expect(doc.data).toHaveProperty('date.created', now)
		expect(doc.data).toHaveProperty('author', {
			username: 'twaits',
			name: { first: 'Tom', last: 'Waits' }
		})
	})

	test('query()', async () => {
		const storage = new MemStore({
			users: [
				{
					id: 1,
					username: 'jdoe',
					name: { first: 'John', last: 'Doe' },
					dateCreated: now
				},
				{
					id: 2,
					username: 'twaits',
					name: { first: 'Tom', last: 'Waits' },
					dateCreated: now
				}
			],
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now,
					author: 1
				},
				{
					id: 2,
					title: 'Post 2',
					content: 'This is the second post',
					dateCreated: now,
					author: 1
				}
			]
		})

		const PostsSchema = new Schema(storage, 'posts', 'id')
		const UsersSchema = new Schema(storage, 'users', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.addSource('posts', [PostsSchema])
			.addSource('author', UsersSchema)
			.map(({ post, author }) => ({
				title: post.title,
				content: post.content,
				date: { created: post.dateCreated },
				author: {
					username: author.username,
					name: author.name
				}
			}))
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
					.populate('author', ({ post }) => ({ id: post.author }))
			)
			.addQuery('byAuthor',
				Query
					.create(true)
					.input(id => ({ author: { id } }))
					.populate('posts', ({ author }) => ({ author: author.id }))
					.populate('author', ({ author }) => ({ id: author.id }))
					.map(({ author, posts }) => posts.map(post => ({ post, author })))
			)
			
		const docs = await Post.query('byAuthor', 1)
		expect(docs).toHaveLength(2)
		expect(docs[0].data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now },
			author: {
				username: 'jdoe',
				name: { first: 'John', last: 'Doe' }
			}
		})
		expect(docs[1].data).toEqual({
			title: 'Post 2',
			content: 'This is the second post',
			date: { created: now },
			author: {
				username: 'jdoe',
				name: { first: 'John', last: 'Doe' }
			}
		})
	})
})

describe('array source', async () => {
	test('get()', async () => {
		const storage = new MemStore({
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				}
			],
			tags: [
				{ id: 1, title: 'Sevr', dateCreated: now },
				{ id: 2, title: 'MongoDB', dateCreated: now },
				{ id: 3, title: 'React', dateCreated: now }
			],
			postTags: [
				{ id: 1, post: 1, tag: 1 },
				{ id: 1, post: 1, tag: 2 },
				{ id: 1, post: 2, tag: 3 }
			]
		})
		const PostsSchema = new Schema(storage, 'posts', 'id')
		const TagsSchema = new Schema(storage, 'tags', 'id')
		const PostTagsSchema = new Schema(storage, 'postTags', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema,)
			.addSource('tagLinks', [PostTagsSchema])
			.addSource('tags', TagsSchema)
			.map(({ post, tags }) => ({
				title: post.title,
				content: post.content,
				date: { created: post.dateCreated },
				tags: tags.map(tag => tag.title)
			}))
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
					.populate('tagLinks', ({ post }) => ({ post: post.id }))
					.populate('tags', ({ tagLinks }) => tagLinks.map(link => ({ id: link.tag })))
			)

		const doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now },
			tags: ['Sevr', 'MongoDB']
		})
	})

	test('mutate()', async () => {
		const storage = new MemStore({
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				}
			],
			tags: [
				{ id: 1, title: 'Sevr', dateCreated: now },
				{ id: 2, title: 'MongoDB', dateCreated: now },
				{ id: 3, title: 'React', dateCreated: now }
			],
			postTags: [
				{ id: 1, post: 1, tag: 1 },
				{ id: 1, post: 1, tag: 2 },
				{ id: 1, post: 2, tag: 3 }
			]
		})
		const PostsSchema = new Schema(storage, 'posts', 'id')
		const TagsSchema = new Schema(storage, 'tags', 'id')
		const PostTagsSchema = new Schema(storage, 'postTags', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.addSource('tagLinks', [PostTagsSchema])
			.addSource('tags', TagsSchema)
			.describe({
				title: {
					type: String,
					data: ({ post }) => post.title
				},
				content: {
					type: String,
					data: ({ post }) => post.content
				},
				date: {
					type: {
						created: Date	
					},
					data: ({ post }) => ({
						created: post.dateCreated
					})
				},
				tags: {
					type: [String],
					data: ({ tags }) => tags.map(tag => tag.title),
					mutation: {
						type: [Number],
						method: [
							{ source: 'tagLinks', data: (tags, { post }) => ({ post: post.id }), operation: 'delete' },
							{ source: 'tagLinks', data: (tags, { post }) => tags.map(tag => ({ post: post.id, tag })), operation: 'create' }
						]
					}
				}
			})
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
					.populate('tagLinks', ({ post }) => ({ post: post.id }))
					.populate('tags', ({ tagLinks }) => tagLinks.map(link => ({ id: link.tag })))
			)
			.addMutation('pushTag', [
				{ source: 'tagLinks', data: (id, { post }) => ({ post: post.id, tag: id }), operation: 'create' }
			])

		let doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now },
			tags: ['Sevr', 'MongoDB']
		})

		doc = await doc.mutate('pushTag', 3)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now },
			tags: ['Sevr', 'MongoDB', 'React']
		})

		doc = await doc.mutate({
			tags: [1, 2]
		})
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now },
			tags: ['Sevr', 'MongoDB']
		})
	})

	test('del()', async () => {
		const storage = new MemStore({
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				}
			],
			tags: [
				{ id: 1, title: 'Sevr', dateCreated: now },
				{ id: 2, title: 'MongoDB', dateCreated: now },
				{ id: 3, title: 'React', dateCreated: now }
			],
			postTags: [
				{ id: 1, post: 1, tag: 1 },
				{ id: 1, post: 1, tag: 2 },
				{ id: 1, post: 2, tag: 3 }
			]
		})
		const PostsSchema = new Schema(storage, 'posts', 'id')
		const TagsSchema = new Schema(storage, 'tags', 'id')
		const PostTagsSchema = new Schema(storage, 'postTags', 'id')

		const Post = Model
			.create()
			.addBoundSource('post', PostsSchema,)
			.addBoundSource('tagLinks', [PostTagsSchema])
			.addSource('tags', TagsSchema)
			.map(({ post, tags }) => ({
				title: post.title,
				content: post.content,
				date: { created: post.dateCreated },
				tags: tags.map(tag => tag.title)
			}))
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
					.populate('tagLinks', ({ post }) => ({ post: post.id }))
					.populate('tags', ({ tagLinks }) => tagLinks.map(link => ({ id: link.tag })))
			)

		const doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now },
			tags: ['Sevr', 'MongoDB']
		})

		const deleted = await doc.del()
		expect(deleted).toEqual([
			{
				source: 'post',
				deleted: [{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				}]
			},
			{
				source: 'tagLinks',
				deleted: [
					{ id: 1, post: 1, tag: 1 },
					{ id: 1, post: 1, tag: 2 }
				]
			}
		])
	})

	test('createNew()', async () => {
		const storage = new MemStore({
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				}
			],
			tags: [
				{ id: 1, title: 'Sevr', dateCreated: now },
				{ id: 2, title: 'MongoDB', dateCreated: now },
				{ id: 3, title: 'React', dateCreated: now }
			],
			postTags: [
				{ id: 1, post: 1, tag: 1 },
				{ id: 1, post: 1, tag: 2 },
				{ id: 1, post: 2, tag: 3 }
			]
		})
		const PostsSchema = new Schema(storage, 'posts', 'id')
		const TagsSchema = new Schema(storage, 'tags', 'id')
		const PostTagsSchema = new Schema(storage, 'postTags', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema,)
			.addSource('tagLinks', [PostTagsSchema])
			.addSource('tags', TagsSchema)
			.describe({
				title: {
					type: String,
					data: ({ post }) => post.title,
					mutation: {
						method: { source: 'post', data: title => ({ title }) }
					}
				},
				content: {
					type: String,
					data: ({ post }) => post.content,
					mutation: {
						method: { source: 'post', data: content => ({ content }) }
					}
				},
				date: {
					type: {
						created: Date	
					},
					data: ({ post }) => ({
						created: post.dateCreated
					}),
					mutation: {
						method: { source: 'post', data: date => ({ dateCreated: date.created }) }
					},
					default: () => ({ created: now })
				},
				tags: {
					type: [String],
					data: ({ tags }) => tags.map(tag => tag.title),
					mutation: {
						type: [Number],
						method: [
							{ source: 'tagLinks', data: (tags, { post }) => ({ post: post.id }), operation: 'delete' },
							{ source: 'tagLinks', data: (tags, { post }) => tags.map(tag => ({ post: post.id, tag })), operation: 'create' }
						]
					}
				}
			})
			.addQuery('default',
				Query
					.create()
					.input(
						input => ({ post: { id: input }}),
						({ post }) => post.id
					)
					.populate('post', ({ post }) => ({ id: post.id }))
					.populate('tagLinks', ({ post }) => ({ post: post.id }))
					.populate('tags', ({ tagLinks }) => tagLinks.map(link => ({ id: link.tag })))
			)

		let doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now },
			tags: ['Sevr', 'MongoDB']
		})

		doc = await Post.create({
			title: 'New Post',
			content: 'New post content',
			tags: [2, 3]
		})
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toHaveProperty('title', 'New Post')
		expect(doc.data).toHaveProperty('content', 'New post content')
		expect(doc.data).toHaveProperty('date.created', now)
		expect(doc.data).toHaveProperty('tags', ['MongoDB', 'React'])
	})

	test('query()', async () => {
		const storage = new MemStore({
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				},
				{
					id: 2,
					title: 'Post 2',
					content: 'This is the second post',
					dateCreated: now
				}
			],
			tags: [
				{ id: 1, title: 'Sevr', dateCreated: now },
				{ id: 2, title: 'MongoDB', dateCreated: now },
				{ id: 3, title: 'React', dateCreated: now }
			],
			postTags: [
				{ id: 1, post: 1, tag: 1 },
				{ id: 1, post: 1, tag: 2 },
				{ id: 1, post: 2, tag: 1 }
			]
		})
		const PostsSchema = new Schema(storage, 'posts', 'id')
		const TagsSchema = new Schema(storage, 'tags', 'id')
		const PostTagsSchema = new Schema(storage, 'postTags', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.addSource('posts', PostsSchema)
			.addSource('tagLinks', [PostTagsSchema])
			.addSource('postLinks', [PostTagsSchema])
			.addSource('tags', TagsSchema)
			.map(({ post, tags }) => ({
				title: post.title,
				content: post.content,
				date: { created: post.dateCreated },
				tags: tags.map(tag => tag.title)
			}))
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
					.populate('tagLinks', ({ post }) => ({ post: post.id }))
					.populate('tags', ({ tagLinks }) => tagLinks.map(link => ({ id: link.tag })))
			)
			.addQuery('withTag',
				Query
					.create(true)
					.input(tagId => ({ tag: { id: tagId } }))
					.populate('tagLinks', ({ tag }) => ({ tag: tag.id }))
					.populate('posts', ({ tagLinks }) => tagLinks.map(link => ({ id: link.post })))
					.populate('postLinks', ({ posts }) => posts.map(post => {
						return { post: post.id }
					}))
					.populate('tags', ({ postLinks }) => {
						return postLinks.reduce((acc, links) => {
							return acc.concat(
								links.map(link => ({ id: link.tag }))
							)
						}, [])
					})
					.map(({ posts, postLinks, tags }) => {
						return posts.map((post, p) => {
							return {
								post,
								tags: postLinks[p].map(link => tags.find(tag => tag.id === link.tag))
							}
						})
					})
			)

		const docs = await Post.query('withTag', 1)
		expect(docs).toHaveLength(2)
		expect(docs[0].data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now },
			tags: ['Sevr', 'MongoDB']
		})
		expect(docs[1].data).toEqual({
			title: 'Post 2',
			content: 'This is the second post',
			date: { created: now },
			tags: ['Sevr']
		})
	})
})

describe('validation', async () => {
	test('mutate()', async() => {
		const storage = new MemStore({
			posts: [
				{
					id: 1,
					title: 'Post 1',
					content: 'This is the first post',
					dateCreated: now
				},
				{
					id: 2,
					title: 'Post 2',
					content: 'This is the second post',
					dateCreated: now
				}
			]
		})
		const PostsSchema = new Schema(storage, 'posts', 'id')

		const Post = Model
			.create()
			.addSource('post', PostsSchema)
			.describe({
				title: {
					type: String,
					required: true,
					data: ({ post }) => post.title,
					mutation: {
						method: { source: 'post', data: title => ({ title }) }
					}
				},
				content: {
					type: String,
					data: ({ post }) => post.content,
					mutation: {
						method: { source: 'post', data: title => ({ title }) }
					}
				},
				date: {
					type: {
						created: Date	
					},
					data: ({ post }) => ({
						created: post.dateCreated
					}),
					mutation: {
						method: { source: 'post', data: date => ({ dateCreated: date.create }) }
					}
				}
			})
			.addQuery('default',
				Query
					.create()
					.input(id => ({ post: { id }}))
					.populate('post', ({ post }) => ({ id: post.id }))
			)

		expect.assertions(8)
		expect(Post.lastError).toBeUndefined()

		let doc = await Post.get(1)
		expect(doc instanceof Document).toBeTruthy()
		expect(doc.data).toEqual({
			title: 'Post 1',
			content: 'This is the first post',
			date: { created: now }
		})

		try {
			await doc.mutate({ title: 1337 })
		} catch (err) {
			expect(err.message).toBe('Invalid')
			expect(Post.lastError).toHaveProperty('err')
			expect(Post.lastError).toHaveProperty('data')
		}

		try {
			await doc.mutate({ content: '' })
		} catch (err) {
			expect(err.message).toBe('Invalid')
			expect(Post.lastError.data[0]).toHaveProperty('reason', 'optional')
		}
	})
})
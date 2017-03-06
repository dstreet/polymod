/* eslint-env jest */
const Model = require('./model')
const Schema = require('./schema')
const Field = require('./field')
const Document = require('./document')
const MemStore = require('../src/mem-store')

const now = new Date()
const initData = {
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
	tags: [
		{ id: 1, title: 'Sevr', dateCreated: now },
		{ id: 2, title: 'MongoDB', dateCreated: now },
		{ id: 3, title: 'React', dateCreated: now }
	],
	posts: [
		{
			id: 1,
			title: 'Post 1',
			content: 'This is the first post',
			dateCreated: now,
			author: 1,
			tags: [1, 2]
		},
		{
			id: 2,
			title: 'Post 2',
			content: 'This is the second post',
			dateCreated: now,
			author: 1,
			tags: [3]
		}
	]
}

test('', async () => {
	const storage = new MemStore({ ...initData })

	const PostsSchema = new Schema(storage, 'posts', 'id')
	const UsersSchema = new Schema(storage, 'users', 'id')
	const TagsSchema = new Schema(storage, 'tags', 'id')

	const PostDate = Model
		.create({
			created: Field.FromSchemaField(PostsSchema, 'dateCreated')
		})

	const Post = Model
		.create({
			title: Field.FromSchemaField(PostsSchema, 'title'),
			content: Field.FromSchemaField(PostsSchema, 'content'),
			author: Field.LinkDocument(
				{ schema: PostsSchema },
				{ schema: UsersSchema },
				'author',
				user => ({ username: user.username, name: user.name }),
				'ONE_TO_ONE'
			),
			tags: Field.LinkDocument(
				{ schema: PostsSchema },
				{ schema: TagsSchema },
				'tags',
				tag => tag.title,
				'ONE_TO_MANY'
			),
			date: PostDate.asField()
		})
		.mutation('pushTag', (doc, newTag) => {
			const fieldDoc = doc.getFieldDocument('tags')
			
			return {
				tags: fieldDoc.tags.concat(newTag)
			}
		})

	const document = await Post.get(1)

	expect(document instanceof Document).toBeTruthy()
	expect(document.fields.title).toHaveProperty('select', { id: 1 })
	expect(document.get('title')).toBe('Post 1')
	expect(document.get('content')).toBe('This is the first post')
	expect(document.get('author')).toEqual({
		username: 'jdoe',
		name: { first: 'John', last: 'Doe' }
	})
	expect(document.get('tags')).toEqual(['Sevr', 'MongoDB'])

	await document.set('title', 'Updated post')
	expect(document.get('title')).toBe('Updated post')
	expect(storage._data.posts[0].title).toBe('Post 1')

	await document.commit()
	expect(storage._data.posts[0].title).toBe('Updated post')

	await document.set('author', 2)
	expect(document.get('author')).toEqual({
		username: 'twaits',
		name: { first: 'Tom', last: 'Waits' }
	})

	await document.commit()
	expect(storage._data.posts[0].author).toBe(2)

	await document.set('tags', [1, 3])
	expect(document.get('tags')).toEqual(['Sevr', 'React'])

	await document.commit()
	expect(storage._data.posts[0].tags).toEqual([1, 3])

	await document.mutate('pushTag', 2)
	expect(document.get('tags')).toEqual(['Sevr', 'React', 'MongoDB'])

	expect(document.get('date') instanceof Document).toBeTruthy()
	expect(document.get('date').get('created')).toEqual(now)

	const now2 = new Date()
	await document.set('date', { created: now2 })
	expect(document.get('date') instanceof Document).toBeTruthy()
	expect(document.get('date').get('created')).toEqual(now2)

	await document.commit()
	expect(storage._data.posts[0].dateCreated).toEqual(now2)
})

test('', async () => {
	const storage = new MemStore({ ...initData })

	const PostsSchema = new Schema(storage, 'posts', 'id')
	const UsersSchema = new Schema(storage, 'users', 'id')

	const AuthorPost = Model
		.create({
			title: Field.FromSchemaField(PostsSchema, 'title', 'author'),
			content: Field.FromSchemaField(PostsSchema, 'content', 'author')
		})

	const Author = Model
		.create({
			username: Field.FromSchemaField(UsersSchema, 'username'),
			name: Field.FromSchemaField(UsersSchema, 'name'),
			posts: AuthorPost.asField(true)
		})

	const document = await Author.get(1)

	expect(document.get('username')).toEqual('jdoe')
	expect(document.get('name')).toEqual({ first: 'John', last: 'Doe' })
	expect(document.get('posts')[0].get('title')).toEqual('Post 1')
	expect(document.get('posts')[1].get('title')).toEqual('Post 2')
})
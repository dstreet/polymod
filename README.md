# Polymod

A library for composing data models from any number of sources.

## Install

```
npm install --save polymod
```

## Example

```javascript
const { Model, Field, Schema, MemStore } = require('polymod')

const data = {
	customers: [
		{
			id: 1,
			name: { first: 'John', last: 'Smith' },
			adddress: {
				street: '300 BOYLSTON AVE E',
				city: 'SEATTLE',
				state: 'WA',
				zip: 98012
			}
		}
	],
	products: [
		{
			id: 1,
			title: 'You Don\'t Know JS: Up & Going',
			isbn: '1491924462',
			price: 4.99
		},
		{
			id: 2,
			title: 'JavaScript: The Good Parts',
			isbn: '0596517742',
			price: 21.93
		}
	],
	orders: [
		{
			id: 1,
			dateCreated: '2017-01-01',
			datePayed: null,
			shipped: false,
			customer: 1,
			products: [1, 2]
		}
	]
}

const store = new MemStore(data)
const CustomersSchema = new Schema(store, 'customers', 'id')
const OrdersSchema = new Schema(store, 'orders', 'id')
const ProductsSchema = new Schema(store, 'products', 'id')

const OrderDate = Model
	.create({
		created: Field.fromSchema(OdersSchema, 'dateCreated'),
		payed: Field.frontSchema(OrdersSchema, 'datePayed')
	})

const OrderDetail = Model
	.create({
		shipped: Field.fromSchema(OrdersSchema, 'shipped'),
		date: OrderDate.asField(),
		customer: Field.LinkDocument(
			{ schema: OrdersSchema },
			{ schema: CustomersSchema },
			'customer',
			customer => ({
				name: customer.name,
				address: customer.address
			}),
			'ONE_TO_ONE'
		),
		products: Field.LinkDocument(
			{ schema: OrdersSchema },
			{ schema: ProductsSchema },
			'products',
			product => ({
				title: product.title,
				price: product.price
			}),
			'ONE_TO_MANY'
		)
	})
	.mutation('removeProductByTitle', (doc, title) => {
		const productsIds = [...doc.getFieldDocument('products')]
		const index = doc.products.findIndex(product => product.title === title)

		productIds.splice(index, 1)

		return {
			products: productIds
		}
	})
```

### Get a model document

```javascript
const order = await OrderDetail.get(1)
```
Result:
```javascript
{
	shipped: false,
	date: {
		created: '2017-01-01',
		payed: null
	},
	customer: {
		name: { first: 'John', last: 'Smith' },
		adddress: {
			street: '300 BOYLSTON AVE E',
			city: 'SEATTLE',
			state: 'WA',
			zip: 98012
		}
	},
	products: [
		{
			title: 'You Don\'t Know JS: Up & Going',
			price: 4.99
		},
		{
			title: 'JavaScript: The Good Parts',
			price: 21.93
		}
	]
}
```

### Get a document property

```javascript
order.get('cutomer')
```
Result:
```javascript
{
	name: { first: 'John', last: 'Smith' },
	adddress: {
		street: '300 BOYLSTON AVE E',
		city: 'SEATTLE',
		state: 'WA',
		zip: 98012
	}
}
```

### Set a document property

```javascript
await order.set('shipped', true)
```

### Get subdocument property

```javascript
order.get('date').get('created')
```
Result:
```javascript
'2017-01-01'
```

### Mutate a document

```javascript
await order.mutate('removeProductByTitle', 'JavaScript: The Good Parts')
```
Result:
```javascript
{
	...
	products: [
		{
			title: 'You Don\'t Know JS: Up & Going',
			price: 4.99
		}
	]
	...
}
```

### Persist changes to the store

```javascript
await order.commit()
```

## Tests

```
npm test
```

## License

This project is licensed under the [MIT license](LICENSE)
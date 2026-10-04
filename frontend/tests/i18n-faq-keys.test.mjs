import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { parse } from '@babel/parser'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function frozenObject(node) {
  assert.equal(node?.type, 'CallExpression')
  assert.equal(node.callee?.type, 'MemberExpression')
  assert.equal(node.callee.object?.name, 'Object')
  assert.equal(node.callee.property?.name, 'freeze')
  assert.equal(node.arguments.length, 1)
  assert.equal(node.arguments[0]?.type, 'ObjectExpression')
  return node.arguments[0]
}

function directProperty(object, name) {
  const properties = object.properties.filter(property => property.type === 'ObjectProperty' && !property.computed && property.key.name === name)
  assert.equal(properties.length, 1, `${name} must be declared once in this object`)
  return properties[0]
}

function catalogObjects(fileName) {
  const source = readFileSync(path.join(frontendRoot, 'src/i18n/messages', fileName), 'utf8')
  const ast = parse(source, { sourceType: 'module' })
  const exported = ast.program.body.find(statement => statement.type === 'ExportDefaultDeclaration')
  return frozenObject(exported?.declaration)
}

for (const fileName of ['pt-BR.js', 'en-US.js']) {
  test(`${fileName} keeps one dashboard FAQ and one landing FAQ`, () => {
    const catalog = catalogObjects(fileName)
    const dashboard = frozenObject(directProperty(catalog, 'dashboard').value)
    const landing = frozenObject(directProperty(catalog, 'landing').value)
    const dashboardFaq = frozenObject(directProperty(dashboard, 'faq').value)
    const landingFaq = frozenObject(directProperty(landing, 'faq').value)

    assert.equal(directProperty(dashboardFaq, 'title').value.value.length > 0, true)
    assert.equal(directProperty(landingFaq, 'title').value.value.length > 0, true)
    assert.ok(directProperty(dashboardFaq, 'items').value)
    assert.ok(directProperty(landingFaq, 'items').value)
  })
}

const DEFAULT_CATEGORIES = ['项目', '实习', '旅游', '记忆', '其他']
const CATEGORY_STORAGE_KEY = 'customCategories'
const OTHER_CATEGORY = '其他'

function uniqueList(list) {
  const result = []
  ;(Array.isArray(list) ? list : []).forEach(item => {
    const value = typeof item === 'string' ? item.trim() : ''
    if (value && !result.includes(value)) result.push(value)
  })
  return result
}

function getUserCategories() {
  const cachedCategories = wx.getStorageSync(CATEGORY_STORAGE_KEY)
  const source = Array.isArray(cachedCategories) && cachedCategories.length ? cachedCategories : DEFAULT_CATEGORIES
  const categories = uniqueList(source)
  return categories.includes(OTHER_CATEGORY) ? categories : [...categories, OTHER_CATEGORY]
}

function saveUserCategories(categories) {
  wx.setStorageSync(CATEGORY_STORAGE_KEY, getCategoriesWithOther(categories))
}

function getCategoriesWithOther(categories) {
  const list = uniqueList(categories)
  return list.includes(OTHER_CATEGORY) ? list : [...list, OTHER_CATEGORY]
}

function normalizeCategory(value, validCategories) {
  const category = typeof value === 'string' && value.trim() ? value.trim() : OTHER_CATEGORY
  if (!Array.isArray(validCategories)) return category
  return validCategories.includes(category) ? category : OTHER_CATEGORY
}

function normalizeTags(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function normalizeRecord(record, validCategories) {
  const safeRecord = record || {}
  return {
    ...safeRecord,
    category: normalizeCategory(safeRecord.category, validCategories),
    tags: normalizeTags(safeRecord.tags)
  }
}

function normalizeRecords(records, validCategories) {
  return (Array.isArray(records) ? records : []).map(record => normalizeRecord(record, validCategories))
}

function migrateCategoryToOther(categoryName) {
  const deletedCategory = typeof categoryName === 'string' ? categoryName.trim() : ''
  if (!deletedCategory || deletedCategory === OTHER_CATEGORY) return []

  const categories = getUserCategories().filter(item => item !== deletedCategory)
  saveUserCategories(categories)

  const rawRecords = wx.getStorageSync('records') || []
  const updatedRecords = (Array.isArray(rawRecords) ? rawRecords : []).map(record => {
    const safeRecord = record || {}
    const currentCategory = safeRecord.category || OTHER_CATEGORY
    const tags = normalizeTags(safeRecord.tags)
    if (currentCategory !== deletedCategory) return { ...safeRecord, tags }
    return {
      ...safeRecord,
      category: OTHER_CATEGORY,
      tags,
      updatedAt: new Date().toISOString()
    }
  })
  wx.setStorageSync('records', updatedRecords)
  return updatedRecords
}

module.exports = {
  DEFAULT_CATEGORIES,
  CATEGORY_STORAGE_KEY,
  OTHER_CATEGORY,
  getUserCategories,
  saveUserCategories,
  normalizeCategory,
  normalizeTags,
  normalizeRecord,
  normalizeRecords,
  migrateCategoryToOther
}

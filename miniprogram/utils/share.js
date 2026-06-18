const SHARE_TITLE = '迹录册｜让每段经历都有迹可循'
const SHARE_DESC = '材料、照片、项目与回忆，都能分类归档、随时导出。'

// TODO: 请补充本地分享封面图片 miniprogram/assets/share-cover.png。
const SHARE_IMAGE = '/assets/share-cover.png'

const HOME_PATH = '/pages/home/home'
const LIST_PATH = '/pages/index/index'

const ROUTE_SHARE_PATHS = {
  'pages/welcome/welcome': HOME_PATH,
  'pages/home/home': HOME_PATH,
  'pages/index/index': '/pages/index/index',
  'pages/timeline/timeline': '/pages/timeline/timeline',
  'pages/export/export': '/pages/export/export'
}

const PRIVATE_ROUTES = {
  'pages/add/add': HOME_PATH,
  'pages/detail/detail': HOME_PATH,
  'pages/proof/proof': LIST_PATH,
  'pages/tagManage/tagManage': HOME_PATH
}

const SAFE_QUERY_KEYS = {
  'pages/welcome/welcome': ['scene'],
  'pages/home/home': ['scene'],
  'pages/index/index': ['scene'],
  'pages/timeline/timeline': ['scene'],
  'pages/export/export': ['scene']
}

function getShareTitle() {
  return SHARE_TITLE
}

function getShareDesc() {
  return SHARE_DESC
}

function getShareImage() {
  return SHARE_IMAGE
}

function getCurrentPage() {
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
  return pages && pages.length ? pages[pages.length - 1] : null
}

function getPageRoute(page) {
  const currentPage = page || getCurrentPage()
  return currentPage && currentPage.route ? currentPage.route : 'pages/home/home'
}

function getPageOptions(page) {
  const currentPage = page || getCurrentPage()
  return (currentPage && currentPage.__shareOptions) || {}
}

function encodeQuery(options, allowKeys) {
  const query = []
  const safeOptions = options || {}

  ;(allowKeys || []).forEach(key => {
    const value = safeOptions[key]

    if (value === undefined || value === null || value === '') return

    query.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  })

  return query.join('&')
}

function appendQuery(path, query) {
  if (!query) return path
  return `${path}?${query}`
}

function getSharePath(page) {
  const route = getPageRoute(page)
  const fallbackPath = ROUTE_SHARE_PATHS[route] || `/${route}`
  const path = PRIVATE_ROUTES[route] || fallbackPath
  const query = PRIVATE_ROUTES[route] ? '' : encodeQuery(getPageOptions(page), SAFE_QUERY_KEYS[route])

  return appendQuery(path, query)
}

function getShareQuery(page) {
  const route = getPageRoute(page)

  if (PRIVATE_ROUTES[route]) {
    return 'shareLanding=home'
  }

  return encodeQuery(getPageOptions(page), SAFE_QUERY_KEYS[route])
}

function showShareMenu() {
  if (!wx || typeof wx.showShareMenu !== 'function') return

  wx.showShareMenu({
    withShareTicket: true,
    menus: ['shareAppMessage', 'shareTimeline']
  })
}

function shouldRedirectShareLanding(page, options) {
  const route = getPageRoute(page)
  return Boolean(PRIVATE_ROUTES[route] && options && options.shareLanding === 'home')
}

function redirectShareLanding(page) {
  const route = getPageRoute(page)
  const path = PRIVATE_ROUTES[route] || HOME_PATH

  wx.reLaunch({ url: path })
}

function defaultShareAppMessage(page) {
  return {
    title: getShareTitle(),
    desc: getShareDesc(),
    path: getSharePath(page),
    imageUrl: getShareImage()
  }
}

function defaultShareTimeline(page) {
  return {
    title: getShareTitle(),
    query: getShareQuery(page),
    imageUrl: getShareImage()
  }
}

function copyShareLink(page) {
  const path = getSharePath(page)

  wx.setClipboardData({
    data: path,
    success() {
      wx.showToast({
        title: '链接已复制，可以发送给朋友',
        icon: 'none'
      })
    }
  })
}

module.exports = {
  HOME_PATH,
  LIST_PATH,
  getShareTitle,
  getShareDesc,
  getSharePath,
  getShareQuery,
  getShareImage,
  showShareMenu,
  shouldRedirectShareLanding,
  redirectShareLanding,
  defaultShareAppMessage,
  defaultShareTimeline,
  copyShareLink
}

const EXAMPLE_FILES = [
  {
    id: 'example_group',
    path: '/images/onboarding/example-community-group.jpg',
    type: '合影照片'
  },
  {
    id: 'example_poster',
    path: '/images/onboarding/example-community-poster.jpg',
    type: '活动海报'
  },
  {
    id: 'example_material',
    path: '/images/onboarding/example-community-material.jpg',
    type: '签到记录'
  }
]

Page({
  data: {
    record: {
      title: '社区环保活动记录',
      dateRangeText: '2024-04-20',
      category: '活动 / 项目',
      location: '城市公园',
      role: '参与者 / 组织协助',
      description: '记录活动过程、个人参与内容和后续可复盘的材料。',
      tags: ['活动', '项目', '环保'],
      proofSummary: [
        { name: '现场照片', count: 1 },
        { name: '活动海报', count: 1 },
        { name: '签到记录', count: 1 }
      ],
      files: EXAMPLE_FILES
    }
  },

  goList() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({ url: '/pages/home/home' })
      }
    })
  },

  previewHeroImage(e) {
    this.previewByIndex(e.currentTarget.dataset.index || 0)
  },

  previewImage(e) {
    this.previewByIndex(e.currentTarget.dataset.index || 0)
  },

  previewByIndex(index) {
    const files = this.data.record.files || []
    const urls = files.map(item => item.path)
    const current = urls[index]

    if (!current) return

    wx.previewImage({ current, urls })
  },

  goAddFromExample() {
    wx.navigateTo({ url: '/pages/add/add?template=communityActivity' })
  },

  goAddBlank() {
    wx.navigateTo({ url: '/pages/add/add' })
  }
})
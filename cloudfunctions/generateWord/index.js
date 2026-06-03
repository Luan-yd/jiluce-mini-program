const cloud = require('wx-server-sdk')
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  ImageRun,
  BorderStyle
} = require('docx')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const BRAND_NAME = '迹录册'
const BODY_COLOR = '202124'
const MUTED_COLOR = '666666'
const HEADING_COLOR = '294C60'
const ERROR_COLOR = '888888'
const EMPTY_TEXT_VALUES = [
  '',
  '未填写',
  '未填写地点',
  '未填写身份',
  '未填写分类',
  '暂无备注',
  '暂无说明',
  '暂无'
]
const IMAGE_LIMITS = {
  landscape: { maxWidth: 460, maxHeight: 320 },
  portrait: { maxWidth: 260, maxHeight: 520 },
  square: { maxWidth: 330, maxHeight: 390 },
  fallback: { maxWidth: 360, maxHeight: 360 }
}

function safeFileName(name) {
  return String(name || 'record')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 40)
}

function padNumber(value) {
  return String(value).padStart(2, '0')
}

function formatDateTime(date = new Date()) {
  const y = date.getFullYear()
  const m = padNumber(date.getMonth() + 1)
  const d = padNumber(date.getDate())
  const h = padNumber(date.getHours())
  const min = padNumber(date.getMinutes())
  return `${y}-${m}-${d} ${h}:${min}`
}

function formatDateRange(record) {
  if (record && record.endDate && record.endDate !== record.date) {
    return `${record.date || ''} 至 ${record.endDate}`
  }

  return (record && record.date) || ''
}

function normalizePrivacy(value) {
  const privateValues = ['private', 'encrypted', 'export_confirm', 'locked']
  return privateValues.includes(value) ? 'private' : 'normal'
}

function getPrivacyText(record) {
  return normalizePrivacy(record && record.privacy) === 'private' ? '私密记录' : '普通记录'
}

function normalizeText(value) {
  return String(value || '').trim()
}

function hasMeaningfulText(value) {
  const text = normalizeText(value)
  return !!text && !EMPTY_TEXT_VALUES.includes(text)
}

function pickText(...values) {
  for (const value of values) {
    if (hasMeaningfulText(value)) return normalizeText(value)
  }
  return ''
}

function getImageTypeFromPath(filePath) {
  const ext = String(filePath || '').split('?')[0].split('.').pop().toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') return 'jpg'
  if (ext === 'gif') return 'gif'
  if (ext === 'bmp') return 'bmp'
  return 'png'
}

function getImageTypeFromBuffer(buffer, filePath) {
  if (!buffer || buffer.length < 12) return getImageTypeFromPath(filePath)

  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'jpg'
  if (buffer.toString('ascii', 0, 8) === '\x89PNG\r\n\x1a\n') return 'png'
  if (buffer.toString('ascii', 0, 3) === 'GIF') return 'gif'
  if (buffer.toString('ascii', 0, 2) === 'BM') return 'bmp'

  return getImageTypeFromPath(filePath)
}

function getPngSize(buffer) {
  if (!buffer || buffer.length < 24) return null
  if (buffer.toString('ascii', 1, 4) !== 'PNG') return null
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  }
}

function getGifSize(buffer) {
  if (!buffer || buffer.length < 10) return null
  if (buffer.toString('ascii', 0, 3) !== 'GIF') return null
  return {
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8)
  }
}

function getBmpSize(buffer) {
  if (!buffer || buffer.length < 26) return null
  if (buffer.toString('ascii', 0, 2) !== 'BM') return null
  return {
    width: Math.abs(buffer.readInt32LE(18)),
    height: Math.abs(buffer.readInt32LE(22))
  }
}

function getJpegSize(buffer) {
  if (!buffer || buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null

  let offset = 2
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1
      continue
    }

    const marker = buffer[offset + 1]
    const blockLength = buffer.readUInt16BE(offset + 2)

    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7)
      }
    }

    offset += 2 + blockLength
  }

  return null
}

function getImageSize(buffer) {
  return getPngSize(buffer) || getJpegSize(buffer) || getGifSize(buffer) || getBmpSize(buffer)
}

function getImageKind(size) {
  if (!size || !size.width || !size.height) return 'fallback'
  const ratio = size.width / size.height
  if (ratio >= 1.2) return 'landscape'
  if (ratio <= 0.8) return 'portrait'
  return 'square'
}

function getDisplaySize(size) {
  const kind = getImageKind(size)
  const limits = IMAGE_LIMITS[kind] || IMAGE_LIMITS.fallback

  if (!size || !size.width || !size.height) {
    return { width: limits.maxWidth, height: limits.maxHeight }
  }

  const scale = Math.min(limits.maxWidth / size.width, limits.maxHeight / size.height, 1)
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale))
  }
}

async function fetchImageBuffer(filePath) {
  try {
    if (!filePath) return null

    const path = String(filePath)

    if (!path.startsWith('cloud://')) {
      return null
    }

    const result = await cloud.downloadFile({ fileID: path })
    return result && result.fileContent ? result.fileContent : null
  } catch (err) {
    console.error('下载图片失败：', filePath, err)
    return null
  }
}

function addParagraph(children, runs, options = {}) {
  children.push(
    new Paragraph({
      alignment: options.alignment,
      spacing: options.spacing || { after: 160 },
      border: options.border,
      children: Array.isArray(runs) ? runs : [runs]
    })
  )
}

function addTextParagraph(children, text, options = {}) {
  if (!options.allowEmpty && !hasMeaningfulText(text)) return

  addParagraph(
    children,
    new TextRun({
      text: normalizeText(text),
      size: options.size || 24,
      bold: !!options.bold,
      color: options.color || BODY_COLOR,
      italics: !!options.italics
    }),
    options
  )
}

function addMainTitle(children, text, options = {}) {
  addParagraph(
    children,
    new TextRun({
      text: normalizeText(text) || '未命名记录',
      bold: true,
      size: options.merge ? 34 : 40,
      color: BODY_COLOR
    }),
    {
      alignment: options.merge ? AlignmentType.LEFT : AlignmentType.CENTER,
      spacing: { before: options.merge ? 120 : 0, after: 260 }
    }
  )
}

function addSectionHeading(children, text) {
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 320, after: 160 },
      border: {
        bottom: {
          color: 'D9E4E1',
          space: 4,
          style: BorderStyle.SINGLE,
          size: 6
        }
      },
      children: [
        new TextRun({
          text,
          bold: true,
          size: 28,
          color: HEADING_COLOR
        })
      ]
    })
  )
}

function addKeyValueRows(children, rows) {
  const visibleRows = rows.filter(row => hasMeaningfulText(row.value))
  if (!visibleRows.length) return

  addSectionHeading(children, '基础信息')
  visibleRows.forEach(row => {
    addParagraph(
      children,
      [
        new TextRun({ text: `${row.label}：`, bold: true, size: 23, color: MUTED_COLOR }),
        new TextRun({ text: normalizeText(row.value), size: 23, color: BODY_COLOR })
      ],
      { spacing: { after: 90 } }
    )
  })
}

function addMultilineText(children, text) {
  const normalized = normalizeText(text)
  if (!hasMeaningfulText(normalized)) return

  normalized.split(/\r?\n/).forEach(line => {
    addTextParagraph(children, line || ' ', {
      allowEmpty: true,
      size: 24,
      color: BODY_COLOR,
      spacing: { after: 120 }
    })
  })
}

function getRecordSummary(record) {
  return pickText(record.summary, record.slogan, record.subtitle)
}

function getRecordDescription(record) {
  return pickText(record.content, record.detail, record.description)
}

function getRecordNotes(record) {
  return pickText(record.reflection, record.thoughts, record.summaryText, record.remark, record.note, record.notes)
}

function getRecordTeam(record) {
  return pickText(record.team, record.group, record.organization, record.org)
}

function getFileCaption(file, index) {
  return pickText(file.caption, file.description, file.remark, file.name, file.type) || `相关图片材料`
}

function getAttachments(record) {
  const sources = [record.attachments, record.attachmentFiles, record.documents]
  const attachments = []

  sources.forEach(list => {
    if (!Array.isArray(list)) return
    list.forEach(item => {
      if (!item) return
      const name = pickText(item.name, item.fileName, item.title)
      const type = pickText(item.type, item.fileType, item.ext)
      const remark = pickText(item.remark, item.description, item.note)
      const uploadedAt = pickText(item.uploadedAt, item.createdAt)
      if (name || type || remark || uploadedAt) {
        attachments.push({ name, type, remark, uploadedAt })
      }
    })
  })

  return attachments
}

function normalizeFiles(record) {
  return (Array.isArray(record.files) ? record.files : [])
    .map(file => ({
      ...file,
      path: file && (file.path || file.fileID || file.url || '')
    }))
    .filter(file => file.path)
}

async function addImageMaterial(children, file, index) {
  const caption = `图 ${index + 1}：${getFileCaption(file, index)}`
  addTextParagraph(children, caption, {
    allowEmpty: true,
    bold: true,
    size: 22,
    color: MUTED_COLOR,
    alignment: AlignmentType.CENTER,
    spacing: { before: index === 0 ? 60 : 240, after: 100 }
  })

  const buf = await fetchImageBuffer(file.path)
  if (!buf) {
    addTextParagraph(children, `图 ${index + 1}：图片读取失败，该图片可能未成功上传或 fileID 无效。`, {
      allowEmpty: true,
      size: 20,
      color: ERROR_COLOR,
      alignment: AlignmentType.CENTER,
      spacing: { after: 220 }
    })
    return
  }

  const size = getImageSize(buf)
  const displaySize = getDisplaySize(size)
  const type = getImageTypeFromBuffer(buf, file.path)

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new ImageRun({
          data: buf,
          type,
          transformation: displaySize
        })
      ]
    })
  )
}

async function addImagesSection(children, record) {
  const files = normalizeFiles(record)
  if (!files.length) return

  addSectionHeading(children, '图片材料')

  for (let i = 0; i < files.length; i++) {
    try {
      await addImageMaterial(children, files[i], i)
    } catch (err) {
      console.error('写入图片到 Word 失败：', files[i] && files[i].path, err)
      addTextParagraph(children, `图 ${i + 1}：图片读取失败，该图片可能未成功上传或 fileID 无效。`, {
        allowEmpty: true,
        size: 20,
        color: ERROR_COLOR,
        alignment: AlignmentType.CENTER,
        spacing: { after: 220 }
      })
    }
  }
}

function addAttachmentsSection(children, record) {
  const attachments = getAttachments(record)
  if (!attachments.length) return

  addSectionHeading(children, '附件 / 证明材料')
  attachments.forEach((item, index) => {
    const parts = [
      item.name,
      item.type ? `类型：${item.type}` : '',
      item.remark ? `备注：${item.remark}` : '',
      item.uploadedAt ? `上传时间：${item.uploadedAt}` : ''
    ].filter(Boolean)

    addTextParagraph(children, `${index + 1}. ${parts.join('；')}`, {
      allowEmpty: true,
      size: 22,
      color: BODY_COLOR,
      spacing: { after: 110 }
    })
  })
}

function addExportInfo(children, exportedAt) {
  addSectionHeading(children, '导出信息')
  addTextParagraph(children, `本文件由「${BRAND_NAME}」生成`, {
    allowEmpty: true,
    size: 21,
    color: MUTED_COLOR,
    spacing: { after: 80 }
  })
  addTextParagraph(children, `导出时间：${exportedAt || formatDateTime()}`, {
    allowEmpty: true,
    size: 21,
    color: MUTED_COLOR,
    spacing: { after: 180 }
  })
}

async function addRecordContent(children, record, options = {}) {
  const safeRecord = record || {}
  const dateText = safeRecord.dateRangeText || formatDateRange(safeRecord)
  const tagsText = Array.isArray(safeRecord.tags) ? safeRecord.tags.filter(Boolean).join('、') : ''
  const summary = getRecordSummary(safeRecord)
  const description = getRecordDescription(safeRecord)
  const notes = getRecordNotes(safeRecord)

  addMainTitle(children, safeRecord.title || '未命名记录', { merge: options.merge })

  if (summary) {
    addTextParagraph(children, summary, {
      size: 23,
      color: MUTED_COLOR,
      italics: true,
      alignment: options.merge ? AlignmentType.LEFT : AlignmentType.CENTER,
      spacing: { after: 260 }
    })
  }

  addKeyValueRows(children, [
    { label: '活动时间 / 经历时间', value: dateText },
    { label: '活动地点 / 地点', value: safeRecord.location },
    { label: '经历分类', value: safeRecord.category },
    { label: '参与角色', value: safeRecord.role },
    { label: '参与团队', value: getRecordTeam(safeRecord) },
    { label: '相关标签', value: tagsText },
    { label: '隐私状态', value: getPrivacyText(safeRecord) }
  ])

  if (description) {
    addSectionHeading(children, '经历描述')
    addMultilineText(children, description)
  }

  if (Array.isArray(safeRecord.proofSummary) && safeRecord.proofSummary.length > 0) {
    addSectionHeading(children, '材料概要')
    addTextParagraph(children, safeRecord.proofSummary.map(item => `${item.name}${item.count}份`).join('，'), {
      allowEmpty: true,
      size: 22,
      color: BODY_COLOR,
      spacing: { after: 160 }
    })
  }

  await addImagesSection(children, safeRecord)
  addAttachmentsSection(children, safeRecord)

  if (notes && notes !== description) {
    addSectionHeading(children, '收获与感想 / 备注')
    addMultilineText(children, notes)
  }

  addExportInfo(children, options.exportedAt)
}

async function buildSingleDocument(record, exportMeta = {}) {
  const children = []
  await addRecordContent(children, record, { merge: false, exportedAt: exportMeta.exportedAt })
  return { children, fileName: safeFileName(record && record.title) }
}

async function buildMergedDocument(records, exportMeta = {}) {
  const children = []
  const exportedAt = exportMeta.exportedAt || formatDateTime()

  addMainTitle(children, exportMeta.title || '经历归档合并导出', { merge: false })
  addTextParagraph(children, `导出时间：${exportedAt}`, {
    allowEmpty: true,
    size: 22,
    color: MUTED_COLOR,
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 }
  })
  if (hasMeaningfulText(exportMeta.condition)) {
    addTextParagraph(children, `导出条件：${exportMeta.condition}`, {
      size: 22,
      color: MUTED_COLOR,
      alignment: AlignmentType.CENTER,
      spacing: { after: 360 }
    })
  }

  for (let i = 0; i < records.length; i++) {
    children.push(new Paragraph({ children: [new PageBreak()] }))
    await addRecordContent(children, records[i], { merge: true, exportedAt })
  }

  return { children, fileName: '经历归档合并导出' }
}

exports.main = async (event) => {
  try {
    const records = Array.isArray(event.records) ? event.records : null
    const record = event.record
    const exportMeta = {
      ...(event.exportMeta || {}),
      exportedAt: event.exportMeta && event.exportMeta.exportedAt ? event.exportMeta.exportedAt : formatDateTime()
    }

    if ((!records || !records.length) && !record) {
      return {
        success: false,
        error: '没有记录数据'
      }
    }

    const docData = records && records.length
      ? await buildMergedDocument(records, exportMeta)
      : await buildSingleDocument(record, exportMeta)

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: {
              font: 'Microsoft YaHei',
              size: 24,
              color: BODY_COLOR
            },
            paragraph: {
              spacing: { line: 320 }
            }
          }
        }
      },
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1000,
                right: 900,
                bottom: 1000,
                left: 900
              }
            }
          },
          children: docData.children
        }
      ]
    })

    const buffer = await Packer.toBuffer(doc)
    const cloudPath = `word/${Date.now()}_${safeFileName(docData.fileName)}.docx`

    const uploadResult = await cloud.uploadFile({
      cloudPath,
      fileContent: buffer
    })

    return {
      success: true,
      fileID: uploadResult.fileID
    }
  } catch (err) {
    console.error('generateWord 云函数执行失败：', err)

    return {
      success: false,
      error: err.message || '生成 Word 失败'
    }
  }
}

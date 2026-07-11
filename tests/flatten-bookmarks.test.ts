import { describe, expect, it } from 'vitest'
import { flattenBookmarks } from '../src/lib/flatten-bookmarks'

describe('flattenBookmarks', () => {
  it('flattens nested folders with path', () => {
    const tree = {
      id: '0',
      title: '',
      children: [
        {
          id: '1',
          title: '书签栏',
          children: [
            {
              id: '2',
              title: '开发',
              children: [
                { id: '3', title: 'React 文档', url: 'https://react.dev/' },
              ],
            },
          ],
        },
      ],
    }
    expect(flattenBookmarks(tree)).toEqual([
      {
        id: '3',
        title: 'React 文档',
        url: 'https://react.dev/',
        folderPath: '书签栏 / 开发',
      },
    ])
  })

  it('skips folders and bookmarklets without http(s)', () => {
    const tree = {
      id: '0',
      title: '',
      children: [
        { id: '1', title: '空文件夹', children: [] },
        { id: '2', title: 'js', url: 'javascript:void(0)' },
        { id: '3', title: 'ok', url: 'http://example.com' },
      ],
    }
    expect(flattenBookmarks(tree).map((b) => b.id)).toEqual(['3'])
  })
})

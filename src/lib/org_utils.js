import generateId from './id_generator';

import { List, fromJS } from 'immutable';

export const indexOfHeaderWithId = (headers, headerId) => {
  return headers.findIndex(header => header.get('id') === headerId);
};

export const headerWithId = (headers, headerId) => {
  return headers.get(indexOfHeaderWithId(headers, headerId));
};

export const subheadersOfHeaderWithId = (headers, headerId) => {
  const header = headerWithId(headers, headerId);
  const headerIndex = indexOfHeaderWithId(headers, headerId);

  const afterHeaders = headers.slice(headerIndex + 1);
  const nextSiblingHeaderIndex = afterHeaders.findIndex(siblingHeader => {
    return siblingHeader.get('nestingLevel') <= header.get('nestingLevel');
  });

  if (nextSiblingHeaderIndex === -1) {
    return afterHeaders;
  } else {
    return afterHeaders.slice(0, nextSiblingHeaderIndex);
  }
};

export const numSubheadersOfHeaderWithId = (headers, headerId) => (
  subheadersOfHeaderWithId(headers, headerId).size
);

export const directParentIdOfHeaderWithId = (headers, headerId) => {
  const header = headerWithId(headers, headerId);
  const headerIndex = indexOfHeaderWithId(headers, headerId);

  for (let i = headerIndex - 1; i >= 0; --i) {
    const previousHeader = headers.get(i);

    if (previousHeader.get('nestingLevel') === header.get('nestingLevel') - 1) {
      return previousHeader.get('id');
    }

    if (previousHeader.get('nestingLevel') < header.get('nestingLevel')) {
      return null;
    }
  }

  return null;
};

export const parentIdOfHeaderWithId = (headers, headerId) => {
  const header = headerWithId(headers, headerId);
  const headerIndex = indexOfHeaderWithId(headers, headerId);

  const previousHeaders = headers.slice(0, headerIndex).reverse();
  const parentHeader = previousHeaders.find(previousHeader => (
    previousHeader.get('nestingLevel') < header.get('nestingLevel')
  ));

  if (!parentHeader) {
    return null;
  }

  return parentHeader.get('id');
};

export const indexOfPreviousSibling = (headers, headerIndex) => {
  const nestingLevel = headers.getIn([headerIndex, 'nestingLevel']);

  for (let i = headerIndex - 1; i >= 0; --i) {
    const header = headers.get(i);

    if (header.get('nestingLevel') < nestingLevel) {
      return null;
    }

    if (header.get('nestingLevel') === nestingLevel) {
      return i;
    }
  }

  return null;
};

const isHeaderVisible = (headers, headerId) => {
  const parentHeaderId = parentIdOfHeaderWithId(headers, headerId);
  if (!parentHeaderId) {
    return true;
  }

  const parentHeader = headerWithId(headers, parentHeaderId);
  return parentHeader.get('opened') && isHeaderVisible(headers, parentHeader.get('id'));
};

export const nextVisibleHeaderAfterIndex = (headers, headerIndex) => {
  const followingHeaders = headers.slice(headerIndex + 1);
  return followingHeaders.find(header => isHeaderVisible(headers, header.get('id')));
};

export const previousVisibleHeaderAfterIndex = (headers, headerIndex) => {
  const previousHeaders = headers.slice(0, headerIndex).reverse();
  return previousHeaders.find(header => isHeaderVisible(headers, header.get('id')));
};

export const openDirectParent = (state, headerId) => {
  const parentHeaderId = directParentIdOfHeaderWithId(state.get('headers'), headerId);
  if (parentHeaderId !== null) {
    const parentHeaderIndex = indexOfHeaderWithId(state.get('headers'), parentHeaderId);
    state = state.setIn(['headers', parentHeaderIndex, 'opened'], true);
  }

  return state;
};

export const getOpenHeaderPaths = headers => {
  let openedHeaders = [];
  for (let i = 0; i < headers.size; ++i) {
    const header = headers.get(i);
    if (!header.get('opened')) {
      continue;
    }

    const title = header.getIn(['titleLine', 'rawTitle']);

    const subheaders = subheadersOfHeaderWithId(headers, header.get('id'));
    const openSubheaderPaths = getOpenHeaderPaths(subheaders);

    if (openSubheaderPaths.length > 0) {
      openSubheaderPaths.forEach(openedSubheaderPath => {
        openedHeaders.push([title].concat(openedSubheaderPath));
      });
    } else {
      openedHeaders.push([title]);
    }

    i += subheaders.size;
  }

  return openedHeaders;
};

export const headerWithPath = (headers, headerPath) => {
  if (headerPath.size === 0) {
    return null;
  }

  const firstHeader = headers.find(header => (
    parentIdOfHeaderWithId(headers, header.get('id')) === null &&
      header.getIn(['titleLine', 'rawTitle']) === headerPath.first()
  ));
  if (!firstHeader) {
    return null;
  }

  if (headerPath.size === 1) {
    return firstHeader;
  }

  const subheaders = subheadersOfHeaderWithId(headers, firstHeader.get('id'));
  return headerWithPath(subheaders, headerPath.skip(1));
};

export const openHeaderWithPath = (headers, headerPath, maxNestingLevel = 1) => {
  if (headerPath.size === 0) {
    return headers;
  }

  const firstTitle = headerPath.first();
  const headerIndex = headers.findIndex(header => {
    const rawTitle = header.getIn(['titleLine', 'rawTitle']);
    const nestingLevel = header.get('nestingLevel');
    return rawTitle === firstTitle && nestingLevel <= maxNestingLevel;
  });
  if (headerIndex === -1) {
    return headers;
  }

  headers = headers.update(headerIndex, header => header.set('opened', true));

  let subheaders = subheadersOfHeaderWithId(headers, headers.getIn([headerIndex, 'id']));
  subheaders = openHeaderWithPath(subheaders, headerPath.rest(), maxNestingLevel + 1);

  headers = headers
    .take(headerIndex + 1)
    .concat(subheaders)
    .concat(headers.takeLast(headers.size - (headerIndex + 1 + subheaders.size)));

  return headers;
};

const tablePartContainsCellId = (tablePart, cellId) => (
  tablePart.get('contents').some(row => (
    row.get('contents').some(cell => cell.get('id') === cellId)
  ))
);

const doesAttributedStringContainTableCellId = (parts, cellId) => (
  parts.filter(part => (
    ['table', 'list'].includes(part.get('type'))
  )).some(part => (
    part.get('type') === 'table' ? (
      tablePartContainsCellId(part, cellId)
    ) : (
      part.get('items').some(item => (
        doesAttributedStringContainTableCellId(item.get('contents'), cellId)
      ))
    )
  ))
);

export const headerThatContainsTableCellId = (headers, cellId) => (
  headers.find(header => (
    doesAttributedStringContainTableCellId(header.get('description'), cellId)
  ))
);

export const pathAndPartOfListItemWithIdInAttributedString = (parts, listItemId) => (
  parts.map((part, partIndex) => {
    if (part.get('type') === 'list') {
      return part.get('items').map((item, itemIndex) => {
        if (item.get('id') === listItemId) {
          return {
            path: [partIndex, 'items', itemIndex],
            listItemPart: item,
          };
        } else {
          const pathAndPart = pathAndPartOfListItemWithIdInAttributedString(item.get('contents'), listItemId);
          if (!!pathAndPart) {
            const { path, listItemPart } = pathAndPart;
            return {
              path: [partIndex, 'items', itemIndex, 'contents'].concat(path),
              listItemPart,
            };
          } else {
            return null;
          }
        }
      }).filter(result => !!result).first();
    } else {
      return null;
    }
  }).filter(result => !!result).first()
);

export const pathAndPartOfTableContainingCellIdInAttributedString = (parts, cellId) => (
  parts.map((part, partIndex) => {
    if (part.get('type') === 'table') {
      if (tablePartContainsCellId(part, cellId)) {
        return { path: [partIndex], tablePart: part };
      } else {
        return null;
      }
    } else if (part.get('type') === 'list') {
      return part.get('items').map((item, itemIndex) => {
        const pathAndPart = pathAndPartOfTableContainingCellIdInAttributedString(item.get('contents'), cellId);
        if (!!pathAndPart) {
          const { path, tablePart } = pathAndPart;
          return {
            path: [partIndex, 'items', itemIndex, 'contents'].concat(path),
            tablePart,
          };
        } else {
          return null;
        }
      }).filter(result => !!result).first();
    } else {
      return null;
    }
  }).filter(result => !!result).first()
);

export const pathAndPartOfListItemWithIdInHeaders = (headers, listItemId) => (
  headers.map((header, headerIndex) => {
    const pathAndPart = pathAndPartOfListItemWithIdInAttributedString(header.get('description'), listItemId);
    if (!pathAndPart) {
      return null;
    }

    const { path, listItemPart } = pathAndPart;
    return {
      path: [headerIndex, 'description'].concat(path),
      listItemPart,
    };
  }).filter(result => !!result).first()
);

export const pathAndPartOfTableContainingCellIdInHeaders = (headers, cellId) => (
  headers.map((header, headerIndex) => {
    const pathAndPart = pathAndPartOfTableContainingCellIdInAttributedString(header.get('description'), cellId);
    if (!pathAndPart) {
      return null;
    }

    const { path, tablePart } = pathAndPart;
    return {
      path: [headerIndex, 'description'].concat(path), tablePart,
    };
  }).filter(result => !!result).first()
);

export const updateTableContainingCellId = (headers, cellId, updaterCallbackGenerator) => {
  const { path, tablePart } = pathAndPartOfTableContainingCellIdInHeaders(headers, cellId);

  const rowIndexContainingCellId = tablePart.get('contents').findIndex(row => (
    row.get('contents').some(cell => cell.get('id') === cellId)
  ));
  const columnIndexContainingCellId = tablePart.getIn([
    'contents', rowIndexContainingCellId, 'contents',
  ]).findIndex(cell => cell.get('id') === cellId);

  return headers.updateIn(path.concat(['contents']), updaterCallbackGenerator(rowIndexContainingCellId, columnIndexContainingCellId));
};

export const newEmptyTableRowLikeRows = rows => (
  rows
    .get(0)
    .set('id', generateId())
    .update('contents', contents => (
      contents.map(cell => (
        cell
          .set('id', generateId())
          .set('contents', new List())
          .set('rawContents', '')
      ))
    ))
);

export const newEmptyTableCell = () => (fromJS({
  id: generateId(),
  contents: [],
  rawContents: '',
}));

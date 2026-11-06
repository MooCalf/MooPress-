import { Extension } from '@tiptap/core';
import { TableView } from '@tiptap/extension-table';

export class BookTableView extends TableView {
  constructor(node, cellMinWidth, view, HTMLAttributes) {
    super(node, cellMinWidth, view, HTMLAttributes);
    this.applyAppearance(node);
  }

  applyAppearance(node) {
    this.table.style.setProperty('--table-border', node.attrs.borderColor || '#999999');
    this.table.style.width = `${node.attrs.tableWidth || 100}%`;
    this.table.style.marginLeft = node.attrs.tableAlign === 'left' ? '0' : 'auto';
    this.table.style.marginRight = node.attrs.tableAlign === 'right' ? '0' : 'auto';
  }

  update(node) {
    if (!super.update(node)) return false;
    this.applyAppearance(node);
    return true;
  }
}

export const TableStyle = Extension.create({
  name: 'bookTableStyle',
  addGlobalAttributes() {
    return [
      { types: ['table'], attributes: {
        borderColor: { default: '#999999', parseHTML: (el) => el.dataset.borderColor || '#999999', renderHTML: (attrs) => ({ 'data-border-color': attrs.borderColor, style: `--table-border:${attrs.borderColor}` }) },
        tableWidth: { default: 100, parseHTML: (el) => +el.dataset.tableWidth || 100, renderHTML: (attrs) => ({ 'data-table-width': attrs.tableWidth, style: `width:${attrs.tableWidth}%` }) },
        tableAlign: { default: 'left', parseHTML: (el) => el.dataset.tableAlign || 'left', renderHTML: (attrs) => ({ 'data-table-align': attrs.tableAlign, style: `margin-left:${attrs.tableAlign === 'left' ? '0' : 'auto'};margin-right:${attrs.tableAlign === 'right' ? '0' : 'auto'}` }) },
      } },
      { types: ['tableCell', 'tableHeader'], attributes: {
        backgroundColor: { default: null, parseHTML: (el) => el.style.backgroundColor || null, renderHTML: (attrs) => attrs.backgroundColor ? { style: `background-color:${attrs.backgroundColor}` } : {} },
      } },
    ];
  },
});

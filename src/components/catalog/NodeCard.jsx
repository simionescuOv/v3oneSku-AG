import { Folder, Tag, ChevronRight, Check, Warehouse } from 'lucide-react'

export function NodeCount({ value }) {
  return <span className="text-sm font-semibold text-zinc-400 shrink-0">{value ?? 0}</span>
}

export default function NodeCard({ node, onTap, selectable = false, selected = false, productCount, subtitle, subtitleClassName, indent }) {
  const isFolder = node.type === 'folder'
  const Icon = isFolder ? Folder : (node.type === 'space' ? Warehouse : Tag)
  const iconColor = isFolder ? 'text-amber-400' : 'text-blue-400'

  return (
    <button
      onClick={() => onTap?.(node)}
      className={[
        'w-full flex items-center gap-3 py-3.5 text-left active:bg-zinc-900',
        indent === undefined ? 'px-4' : '',
        selectable && selected ? 'border-l-2 border-blue-500 bg-zinc-900/60' : '',
      ].join(' ')}
      style={indent !== undefined ? { paddingLeft: indent, paddingRight: 16 } : undefined}
    >
      {selectable && (
        <span
          className={[
            'shrink-0 flex items-center justify-center w-5 h-5 rounded-full border',
            selected ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-600 text-transparent',
          ].join(' ')}
        >
          <Check size={14} />
        </span>
      )}
      <Icon size={18} className={`${iconColor} shrink-0`} />
      <div className="flex-1 min-w-0">
        <span className="text-sm text-zinc-100 truncate block">{node.name}</span>
        {subtitle && (
          <span className={`text-xs truncate block ${subtitleClassName || 'text-zinc-500'}`}>{subtitle}</span>
        )}
      </div>
      {isFolder ? (
        !selectable && <ChevronRight size={16} className="text-zinc-600 shrink-0" />
      ) : (
        <NodeCount value={productCount} />
      )}
    </button>
  )
}

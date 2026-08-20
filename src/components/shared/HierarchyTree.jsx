import { ChevronDown, ChevronRight, Folder, Tag, Check, Warehouse } from 'lucide-react'
import NodeCard, { NodeCount } from '../catalog/NodeCard'

export function SearchGroup({ group, depth, onTap, productCounts }) {
  const indent = 16 + depth * 16
  return (
    <>
      {group.node && (
        group.matched ? (
          <button
            onClick={() => onTap(group.node)}
            className="w-full flex items-center gap-2 py-2 text-left text-xs font-medium text-amber-400 bg-zinc-900/60 active:bg-zinc-900"
            style={{ paddingLeft: indent, paddingRight: 16 }}
          >
            <Folder size={14} className="shrink-0" />
            <span className="flex-1 truncate">{group.node.name}</span>
            <ChevronRight size={14} className="text-zinc-600 shrink-0" />
          </button>
        ) : (
          <div
            className="flex items-center gap-2 py-2 text-xs font-medium text-amber-400 bg-zinc-900/60"
            style={{ paddingLeft: indent, paddingRight: 16 }}
          >
            <Folder size={14} className="shrink-0" />
            {group.node.name}
          </div>
        )
      )}
      {group.categories.map((cat) => (
        <NodeCard
          key={cat.id}
          node={cat}
          onTap={onTap}
          productCount={productCounts?.[cat.id]}
          indent={indent + (group.node ? 16 : 0)}
        />
      ))}
      {group.children.map((child) => (
        <SearchGroup key={child.node.id} group={child} depth={depth + 1} onTap={onTap} productCounts={productCounts} />
      ))}
    </>
  )
}

export function FullTree({ 
  parentId, 
  depth, 
  getChildren, 
  selectable, 
  selectedIds, 
  onToggle, 
  collapsedIds, 
  onToggleFold, 
  visibleIds, 
  currentFolderId, 
  productCounts,
  onNodeTap // fix for bug: we need to navigate on leaf node tap
}) {
  let children = getChildren(parentId)
  if (visibleIds) children = children.filter((n) => visibleIds.has(n.id))
    
  return children.map((node) => {
    const isFolder = node.type === 'folder'
    const isSpace = node.type === 'space'
    const isLeaf = node.type === 'category' || node.type === 'space'
    const isCollapsed = isFolder && !visibleIds && collapsedIds.has(node.id)
    const isCurrent = isFolder && node.id === currentFolderId

    // Choose the right icon
    const Icon = isFolder ? Folder : (isSpace ? Warehouse : Tag)
    const iconColor = isFolder ? 'text-amber-400' : 'text-blue-400'

    // Fix bug: navigate if we are not in select mode and it's a leaf node.
    const handleClick = isFolder 
      ? () => onToggleFold(node.id) 
      : (selectable ? () => onToggle(node.id) : () => onNodeTap?.(node))

    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-2 py-2.5 text-sm border-b border-zinc-900"
          style={{ paddingLeft: 16 + depth * 16, paddingRight: 16 }}
        >
          {selectable && (
            <span
              onClick={() => onToggle(node.id)}
              className={[
                'shrink-0 flex items-center justify-center w-5 h-5 rounded-full border',
                selectedIds.has(node.id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-600 text-transparent',
              ].join(' ')}
            >
              <Check size={14} />
            </span>
          )}
          <div
            className="flex-1 flex items-center gap-2 min-w-0"
            onClick={handleClick}
          >
            {isFolder
              ? (isCollapsed ? <ChevronRight size={14} className="text-zinc-500 shrink-0" /> : <ChevronDown size={14} className="text-zinc-500 shrink-0" />)
              : <span className="w-3.5 shrink-0" />
            }
            <Icon size={16} className={`${iconColor} shrink-0`} />
            <span className={isCurrent ? 'flex-1 text-amber-400 font-semibold truncate' : 'flex-1 text-zinc-100 truncate'}>
              {node.name}
            </span>
            {isLeaf && (
              <NodeCount value={productCounts?.[node.id]} />
            )}
          </div>
        </div>
        {isFolder && !isCollapsed && (
          <FullTree
            parentId={node.id}
            depth={depth + 1}
            getChildren={getChildren}
            selectable={selectable}
            selectedIds={selectedIds}
            onToggle={onToggle}
            collapsedIds={collapsedIds}
            onToggleFold={onToggleFold}
            visibleIds={visibleIds}
            currentFolderId={currentFolderId}
            productCounts={productCounts}
            onNodeTap={onNodeTap}
          />
        )}
      </div>
    )
  })
}

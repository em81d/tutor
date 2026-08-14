import { curriculum } from './curriculum.js'

// Flattens the curriculum into the same item ids CurriculumPage.jsx generates for its
// trackable chips, so transcript analysis can reference the exact ids the progress
// table already uses. Used server-side (via a plain Node import) to build the item
// list sent to the LLM for progress extraction.
export function getCurriculumItems() {
  const items = []

  for (const unit of curriculum) {
    for (const group of unit.vocabGroups) {
      for (const item of group.items) {
        items.push({ id: `${unit.id}-vocab-${group.name}-${item.es}`, type: 'vocab', es: item.es, en: item.en })
      }
    }
    for (const topic of unit.grammarTopics) {
      items.push({
        id: `${unit.id}-grammar-${topic.name}`,
        type: 'grammar',
        es: topic.name,
        en: topic.summary,
      })
    }
    for (const group of unit.phraseGroups) {
      for (const item of group.items) {
        items.push({ id: `${unit.id}-phrase-${group.category}-${item.es}`, type: 'phrase', es: item.es, en: item.en })
      }
    }
  }

  return items
}

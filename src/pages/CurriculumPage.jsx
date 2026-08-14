import { Link } from 'react-router-dom'
import { curriculum } from '../data/curriculum'
import { useProgress } from '../hooks/useProgress'
import { useUser } from '../hooks/useUser'
import { scoreToBucket } from '../lib/progressScore'

function TrackableChip({ id, status, onClick, primary, secondary }) {
  const statusClasses =
    status === 'learning'
      ? 'bg-learning-bg border-learning-border'
      : status === 'mastered'
        ? 'bg-mastered-bg border-mastered-border'
        : 'bg-code-bg border-border'
  const primaryClasses =
    status === 'learning' ? 'text-learning-text' : status === 'mastered' ? 'text-mastered-text' : ''

  return (
    <button
      type="button"
      className={`flex max-w-[320px] flex-col gap-0.5 rounded-[10px] border px-3 py-2 text-left text-sm text-text-h cursor-pointer transition-[transform,background-color,border-color] duration-100 hover:scale-[1.02] ${statusClasses}`}
      onClick={() => onClick(id)}
      title={secondary}
    >
      <span className={`font-medium ${primaryClasses}`}>{primary}</span>
      {secondary && <span className="text-xs text-text truncate">{secondary}</span>}
    </button>
  )
}

function UnitSection({ unit, progress, cycleStatus }) {
  return (
    <section className="mt-6 border-t border-border pt-6">
      <h2 className="text-left text-xl lg:text-2xl font-medium leading-[118%] tracking-[-0.24px] text-text-h mb-2">
        {unit.title} <span className="font-normal text-text">— {unit.subtitle}</span>
      </h2>

      {unit.vocabGroups.length > 0 && (
        <div className="mb-5">
          <h3 className="text-base text-text-h mb-2.5">Vocabulary</h3>
          {unit.vocabGroups.map((group) => (
            <div className="mb-3.5" key={group.name}>
              <h4 className="text-[13px] font-semibold text-text uppercase tracking-[0.04em] mb-2">
                {group.name}
              </h4>
              <div className="flex flex-wrap gap-2">
                {group.items.map((item) => {
                  const id = `${unit.id}-vocab-${group.name}-${item.es}`
                  return (
                    <TrackableChip
                      key={id}
                      id={id}
                      status={scoreToBucket(progress[id])}
                      onClick={cycleStatus}
                      primary={item.es}
                      secondary={item.note ? `${item.en} · ${item.note}` : item.en}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {unit.grammarTopics.length > 0 && (
        <div className="mb-5">
          <h3 className="text-base text-text-h mb-2.5">Grammar</h3>
          <div className="flex flex-wrap gap-2">
            {unit.grammarTopics.map((topic) => {
              const id = `${unit.id}-grammar-${topic.name}`
              return (
                <TrackableChip
                  key={id}
                  id={id}
                  status={progress[id]}
                  onClick={cycleStatus}
                  primary={topic.name}
                  secondary={topic.summary}
                />
              )
            })}
          </div>
        </div>
      )}

      {unit.phraseGroups.length > 0 && (
        <div className="mb-5">
          <h3 className="text-base text-text-h mb-2.5">Phrases &amp; Topics</h3>
          {unit.phraseGroups.map((group) => (
            <div className="mb-3.5" key={group.category}>
              <h4 className="text-[13px] font-semibold text-text uppercase tracking-[0.04em] mb-2">
                {group.category}
              </h4>
              <div className="flex flex-wrap gap-2">
                {group.items.map((item) => {
                  const id = `${unit.id}-phrase-${group.category}-${item.es}`
                  return (
                    <TrackableChip
                      key={id}
                      id={id}
                      status={scoreToBucket(progress[id])}
                      onClick={cycleStatus}
                      primary={item.es}
                      secondary={item.en}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function CurriculumPage() {
  const { user } = useUser()
  const { progress, cycleStatus, loading } = useProgress(user?.id)
  const buckets = Object.values(progress).map(scoreToBucket)
  const learningCount = buckets.filter((b) => b === 'learning').length
  const masteredCount = buckets.filter((b) => b === 'mastered').length

  return (
    <div id="curriculum" className="grow box-border px-6 pt-8 pb-16 text-left">
      <div className="text-center mb-6">
        <Link to="/" className="inline-block mb-2 text-[15px] text-accent no-underline hover:underline">
          ← Back to conversation
        </Link>
        <h1 className="text-[36px] lg:text-[56px] tracking-[-1.68px] font-medium text-text-h my-5 lg:my-8">
          Curriculum
        </h1>
        <p className="max-w-[560px] mx-auto mb-2 text-[15px]">
          Click a word or topic once to mark it{' '}
          <span className="inline-block w-2.5 h-2.5 rounded-full align-middle mx-0.5 bg-learning-border" /> working
          on, click again to mark it{' '}
          <span className="inline-block w-2.5 h-2.5 rounded-full align-middle mx-0.5 bg-mastered-border" /> mastered,
          and once more to reset.
        </p>
        <p className="text-sm font-semibold text-text-h">
          {learningCount} working on &middot; {masteredCount} mastered
        </p>
      </div>

      {loading ? (
        <p className="text-center py-10">Loading your progress…</p>
      ) : (
        curriculum.map((unit) => (
          <UnitSection key={unit.id} unit={unit} progress={progress} cycleStatus={cycleStatus} />
        ))
      )}
    </div>
  )
}

export default CurriculumPage

import { useState } from 'react'
import { useUser } from '../hooks/useUser'

function NameGate({ children }) {
  const { user, login, logout, error, loggingIn } = useUser()
  const [name, setName] = useState('')

  if (!user) {
    return (
      <div id="name-gate" className="grow flex justify-center items-center box-border px-5 py-8">
        <form
          className="flex flex-col items-center gap-3 max-w-[320px] text-center"
          onSubmit={(e) => {
            e.preventDefault()
            login(name)
          }}
        >
          <h1 className="text-[36px] lg:text-[56px] tracking-[-1.68px] leading-tight font-medium text-text-h my-5 lg:my-8">
            Who's learning?
          </h1>
          <p className="text-[15px] mb-2">Enter your name to load or start your progress.</p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoFocus
            className="w-full box-border px-3.5 py-2.5 text-base border border-border rounded-lg bg-bg text-text-h"
          />
          <button
            type="submit"
            disabled={loggingIn || !name.trim()}
            className="text-[15px] font-medium text-white bg-accent rounded-full px-6 py-2.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loggingIn ? 'Loading…' : 'Continue'}
          </button>
          {error && <p className="text-danger text-sm">{error}</p>}
        </form>
      </div>
    )
  }

  return (
    <>
      <div className="flex justify-end items-center gap-2.5 px-5 py-2.5 border-b border-border text-sm">
        <span className="text-text-h font-medium">{user.name}</span>
        <button
          type="button"
          onClick={logout}
          className="text-[13px] text-accent bg-transparent border-none cursor-pointer p-0 hover:underline"
        >
          Switch user
        </button>
      </div>
      {children}
    </>
  )
}

export default NameGate

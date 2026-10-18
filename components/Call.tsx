'use client';

import { useEffect } from 'react';
import type { Action } from '@/lib/game/actions';
import { RING_MS, type Call as CallT } from '@/lib/game/calls';

/** An incoming call from someone in town. Ringing, then their line in a speech bubble once you pick up. */
export function Call({ call, dispatch, font }: { call: CallT; dispatch: (a: Action) => void; font: string }) {
  // unanswered calls go to voicemail
  useEffect(() => {
    if (call.answered) return;
    const left = Math.max(0, RING_MS - (Date.now() - call.t0));
    const id = window.setTimeout(() => dispatch({ type: 'call', act: 'missed' }), left);
    return () => window.clearTimeout(id);
  }, [call.id, call.answered, call.t0, dispatch]);

  return (
    <div className={`call${call.answered ? ' on' : ' ringing'}`} role="alertdialog" aria-label={`Call from ${call.who}`}>
      <div className="call-top">
        <i className={`caller ${call.mood}`} aria-hidden="true" />
        <div>
          <span className="call-state">{call.answered ? 'On the line' : 'Incoming call'}</span>
          <b>{call.who}</b>
        </div>
      </div>
      {call.answered && <p className={`call-line ${font}`}>“{call.line}”</p>}
      <div className="call-foot">
        {call.answered ? (
          <button className="pill" onClick={() => dispatch({ type: 'call', act: 'hangup' })}>Hang up</button>
        ) : (
          <>
            <button className="pill decline" onClick={() => dispatch({ type: 'call', act: 'decline' })}>Decline</button>
            <button className="pill answer" onClick={() => dispatch({ type: 'call', act: 'answer' })}>Answer</button>
          </>
        )}
      </div>
    </div>
  );
}

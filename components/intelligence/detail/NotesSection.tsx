'use client';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StickyNote, Loader2, FileText, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Contact } from '@/lib/types';
import { useState } from 'react';

export function NotesSection({
  contact,
  contactId,
  onSaved,
}: {
  contact: Contact;
  contactId: string;
  onSaved?: () => void;
}) {
  const [notes, setNotes] = useState(contact.intelligence_notes || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!contactId) {
      toast.error('Unable to save note. Please try again.');
      return;
    }
    setSaving(true);
    setSaved(false);
    const { error } = await supabase
      .from('contacts')
      .update({ intelligence_notes: notes, updated_at: new Date().toISOString() })
      .eq('id', contactId);
    if (error) {
      console.error('[NotesSection] Supabase update error:', error);
      toast.error('Unable to save note. Please try again.');
    } else {
      toast.success('Notes saved');
      setSaved(true);
      onSaved?.();
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  const hasNotes = notes.trim().length > 0;
  const isEditing = hasNotes || notes !== (contact.intelligence_notes || '');

  return (
    <div className="flex flex-col h-full">
      {isEditing ? (
        <Textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setSaved(false);
          }}
          placeholder="Add a private note about this executive..."
          rows={8}
          className="resize-none flex-1 min-h-[200px]"
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground mb-3">
            <FileText className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">No notes yet</p>
          <p className="text-xs text-muted-foreground mb-4 max-w-xs">
            Add a private note about this executive.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setNotes(' ')}
          >
            <StickyNote className="h-4 w-4 mr-1.5" />
            Add Note
          </Button>
        </div>
      )}
      {isEditing && (
        <div className="flex justify-end mt-3">
          <Button size="sm" onClick={handleSave} disabled={saving || notes === (contact.intelligence_notes || '')}>
            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : saved ? <Check className="h-4 w-4 mr-1.5" /> : <StickyNote className="h-4 w-4 mr-1.5" />}
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save Notes'}
          </Button>
        </div>
      )}
    </div>
  );
}

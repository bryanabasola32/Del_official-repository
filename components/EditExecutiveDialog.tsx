'use client';

import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { Contact } from '@/lib/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  onSaved?: () => void;
}

export function EditExecutiveDialog({ open, onOpenChange, contact, onSaved }: Props) {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [industry, setIndustry] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [personaProvided, setPersonaProvided] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (contact) {
      setName(contact.name || '');
      setTitle(contact.title || '');
      setCompany(contact.company || '');
      setIndustry(contact.industry || '');
      setEmail(contact.email || '');
      setPhone(contact.phone || '');
      setLinkedin(contact.linkedin || '');
      setPersonaProvided(contact.persona_provided || '');
      setNotes(contact.notes || '');
    }
  }, [contact]);

  const handleSave = async () => {
    if (!contact) return;
    if (!name.trim() || !company.trim()) {
      toast.error('Name and company are required');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('contacts').update({
      name: name.trim(),
      title: title.trim() || null,
      company: company.trim(),
      industry: industry.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      linkedin: linkedin.trim() || null,
      persona_provided: personaProvided.trim() || null,
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', contact.id);

    if (error) {
      toast.error('Failed to update executive: ' + error.message);
      setSaving(false);
      return;
    }

    await supabase.from('activity_log').insert({
      action_type: 'edit_executive',
      related_contact_id: contact.id,
      status: 'success',
      description: `Updated executive: ${name}`,
    });

    toast.success(`${name} updated`);
    onOpenChange(false);
    onSaved?.();
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Edit Executive
          </DialogTitle>
          <DialogDescription>
            Update client-provided information. AI-generated intelligence is managed separately.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Maria Santos" />
            </div>
            <div className="space-y-2">
              <Label>Position *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Chief Information Officer" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Company *</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="BDO Unibank" />
            </div>
            <div className="space-y-2">
              <Label>Industry</Label>
              <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Banking & Finance" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="msantos@bdo.com.ph" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+63 917 123 4567" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>LinkedIn URL</Label>
            <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/maria-santos" />
          </div>
          <div className="space-y-2">
            <Label>Persona (client-provided)</Label>
            <Textarea
              value={personaProvided}
              onChange={(e) => setPersonaProvided(e.target.value)}
              placeholder="Any persona description the client has provided..."
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim() || !company.trim()}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

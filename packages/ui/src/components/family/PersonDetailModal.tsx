"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { usePersonRelationships } from "@/hooks/usePersonRelationships";
import type { Person, UserRole } from "@/types";
import { GENDER_LABELS } from "@/types";
import { uintToDateString } from "@/lib/date";

interface PersonDetailModalProps {
  person: Person | null;
  open: boolean;
  onClose: () => void;
  treeId?: bigint;
  role?: UserRole;
  onAdoptClick?: (personId: bigint) => void;
}

export function PersonDetailModal({ person, open, onClose, treeId, role, onAdoptClick }: PersonDetailModalProps) {
  const personId = person?.id;
  const { couples, crossCouples, isLoading: relLoading } = usePersonRelationships(
    open ? personId : undefined
  );

  if (!person) return null;

  const dob = uintToDateString(person.dob, "long");

  return (
    <Modal open={open} onClose={onClose} title={person.name}>
      <dl className="space-y-4">
        <div>
          <dt className="text-sm text-gray-500">Person ID</dt>
          <dd className="text-gray-200 font-mono">#{person.id.toString()}</dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Date of Birth</dt>
          <dd className="text-gray-200">{dob}</dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Gender</dt>
          <dd className="text-gray-200">{GENDER_LABELS[person.gender]}</dd>
        </div>
        {person.profileURI && (
          <div>
            <dt className="text-sm text-gray-500">Profile</dt>
            <dd className="text-gray-200 break-all text-sm">{person.profileURI}</dd>
          </div>
        )}
      </dl>

      {/* Relationships */}
      <div className="mt-4 pt-4 border-t border-gray-700 space-y-3">
        <h4 className="text-sm font-medium text-gray-400">Relationships</h4>
        {relLoading ? (
          <div className="flex justify-center py-2">
            <Spinner size="sm" />
          </div>
        ) : couples.length === 0 && crossCouples.length === 0 ? (
          <p className="text-xs text-gray-600">No couple relationships found.</p>
        ) : (
          <div className="space-y-2">
            {couples.map((c) => (
              <div
                key={c.id.toString()}
                className="text-xs bg-gray-800/50 rounded-lg px-3 py-2 text-gray-300"
              >
                Couple #{c.id.toString()} &mdash; Partners #{c.partner1Id.toString()} &amp; #{c.partner2Id.toString()}
                {c.childrenIds.length > 0 && (
                  <span className="text-gray-500">
                    {" "}({c.childrenIds.length} {c.childrenIds.length === 1 ? "child" : "children"})
                  </span>
                )}
              </div>
            ))}
            {crossCouples.map((c) => (
              <div
                key={c.id.toString()}
                className="text-xs bg-gray-800/50 rounded-lg px-3 py-2 text-gray-300"
              >
                Cross-Couple #{c.id.toString()} &mdash; Trees #{c.tree1Id.toString()} &amp; #{c.tree2Id.toString()}
                <span className={c.approved ? "text-green-400" : "text-amber-400"}>
                  {" "}({c.approved ? "Approved" : "Pending"})
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {onAdoptClick && (role === "creator" || role === "admin") && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onAdoptClick(person.id)}
          >
            Adopt to Couple
          </Button>
        </div>
      )}
    </Modal>
  );
}

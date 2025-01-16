import Principal "mo:base/Principal";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Result "mo:base/Result";
import Nat "mo:base/Nat";
import Hash "mo:base/Hash";
import Array "mo:base/Array";
import Time "mo:base/Time";
import Text "mo:base/Text";

module {
    public type Approval = {
        id: Nat;
        date: Int;  // Time.Time 타입 사용
        phone: Text;
        patientName: Text;
        title: Text;
        sender: {
            hospital: Text;
            department: Text;
            doctor: Text;
        };
        receiver: {
            hospital: Text;
            department: Text;
            doctor: Text;
        };
        cid: Text;
        encryptedAesKeyForSender: Text;
        encryptedAesKeyForReceiver: Text;
        status: Text;  // "승인대기중", "승인완료", "승인거절"
    };

    public class ApprovalManager() {
        private var approvals = HashMap.HashMap<Nat, Approval>(1, Nat.equal, Hash.hash);
        private var nextId : Nat = 1;

        public func createApproval(approval: Approval) : Result.Result<Approval, Text> {
            let id = nextId;
            nextId += 1;

            let newApproval = {
                id = id;
                date = Time.now();
                phone = approval.phone;
                patientName = approval.patientName;
                title = approval.title;
                sender = approval.sender;
                receiver = approval.receiver;
                cid = approval.cid;
                encryptedAesKeyForSender = approval.encryptedAesKeyForSender;
                encryptedAesKeyForReceiver = approval.encryptedAesKeyForReceiver;
                status = "승인대기중";
            };

            approvals.put(id, newApproval);
            #ok(newApproval)
        };

        public func updateApprovalStatus(id: Nat, status: Text) : Result.Result<Approval, Text> {
            switch (approvals.get(id)) {
                case (null) { #err("해당 ID의 승인 요청을 찾을 수 없습니다.") };
                case (?approval) {
                    let updatedApproval = {
                        id = approval.id;
                        date = approval.date;
                        phone = approval.phone;
                        patientName = approval.patientName;
                        title = approval.title;
                        sender = approval.sender;
                        receiver = approval.receiver;
                        cid = approval.cid;
                        encryptedAesKeyForSender = approval.encryptedAesKeyForSender;
                        encryptedAesKeyForReceiver = approval.encryptedAesKeyForReceiver;
                        status = status;
                    };
                    approvals.put(id, updatedApproval);
                    #ok(updatedApproval)
                };
            }
        };

        public func getAllApprovals() : [Approval] {
            Iter.toArray(approvals.vals())
        };

        public func getApprovalsByDoctor(doctorName: Text, role: Text) : [Approval] {
            let allApprovals = Iter.toArray(approvals.vals());
            Array.filter<Approval>(allApprovals, func(approval: Approval) : Bool {
                if (role == "sender") {
                    approval.sender.doctor == doctorName
                } else {
                    approval.receiver.doctor == doctorName
                }
            })
        };

        public func getApproval(id: Nat) : ?Approval {
            approvals.get(id)
        };
    };
}; 
import Principal "mo:base/Principal";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Result "mo:base/Result";
import Nat "mo:base/Nat";
import Hash "mo:base/Hash";
import Array "mo:base/Array";
import Time "mo:base/Time";
import Text "mo:base/Text";
import Int "mo:base/Int";
import Order "mo:base/Order";

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

    public type PagedResult = {
        items: [Approval];
        total: Nat;
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

        public func getAllApprovals(offset: Nat, limit: Nat) : PagedResult {
            let allApprovals = Iter.toArray(approvals.vals());
            
            // ID 기준 내림차순 정렬
            let sortedApprovals = Array.sort<Approval>(
                allApprovals,
                func(a: Approval, b: Approval) : Order.Order {
                    if (a.id > b.id) { #less } 
                    else if (a.id < b.id) { #greater } 
                    else { #equal }
                }
            );

            // 페이지네이션 적용
            let total = sortedApprovals.size();
            let start = if (offset >= total) { total } else { offset };
            let end = if (start + limit > total) { total } else { start + limit };
            let pagedApprovals = Array.tabulate<Approval>(
                end - start,
                func(i: Nat) : Approval { sortedApprovals[start + i] }
            );

            {
                items = pagedApprovals;
                total = total;
            }
        };

        public func getApprovalsByDoctor(doctorName: Text, role: Text, offset: Nat, limit: Nat) : PagedResult {
            let allApprovals = Iter.toArray(approvals.vals());
            
            // 1. 해당 의사의 승인 목록 필터링
            let filteredApprovals = Array.filter<Approval>(allApprovals, func(approval: Approval) : Bool {
                if (role == "sender") {
                    approval.sender.doctor == doctorName
                } else {
                    approval.receiver.doctor == doctorName
                }
            });

            // 2. ID 기준 내림차순 정렬
            let sortedApprovals = Array.sort<Approval>(
                filteredApprovals,
                func(a: Approval, b: Approval) : Order.Order {
                    if (a.id > b.id) { #less } 
                    else if (a.id < b.id) { #greater } 
                    else { #equal }
                }
            );

            // 3. 페이지네이션 적용
            let total = sortedApprovals.size();
            let start = if (offset >= total) { total } else { offset };
            let end = if (start + limit > total) { total } else { start + limit };
            let pagedApprovals = Array.tabulate<Approval>(
                end - start,
                func(i: Nat) : Approval { sortedApprovals[start + i] }
            );

            {
                items = pagedApprovals;
                total = total;
            }
        };

        public func getApproval(id: Nat) : ?Approval {
            approvals.get(id)
        };
    };
}; 
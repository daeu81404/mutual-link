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
import Option "mo:base/Option";

module {
    public type Approval = {
        id: Nat;
        date: Int;  // Time.Time 타입 사용
        phone: Text;
        patientName: Text;
        title: Text;
        description: Text;
        fromDoctor: Text;
        fromEmail: Text;  // 송신자 이메일 추가
        fromHospital: Text;
        fromDepartment: Text;
        fromPhone: Text;
        toDoctor: Text;
        toEmail: Text;  // 수신자 이메일 추가
        toHospital: Text;
        toDepartment: Text;
        toPhone: Text;
        cid: Text;
        encryptedAesKeyForSender: Text;
        encryptedAesKeyForReceiver: Text;
        status: Text;  // "pending", "approved", "rejected"
        originalApprovalId: ?Nat;
        transferredDoctors: [Text];  // 이관에 참여한 의사 목록
    };

    public type TransferHistory = {
        id: Nat;
        fromDoctor: Text;
        fromEmail: Text;
        fromHospital: Text;
        fromDepartment: Text;
        fromPhone: Text;
        toDoctor: Text;
        toEmail: Text;
        toHospital: Text;
        toDepartment: Text;
        toPhone: Text;
        date: Int;
        originalApprovalId: Nat;
    };

    public type PagedResult = {
        items: [Approval];
        total: Nat;
    };

    public class ApprovalManager() {
        private var approvals = HashMap.HashMap<Nat, Approval>(1, Nat.equal, Hash.hash);
        private var transferHistories = HashMap.HashMap<Nat, [TransferHistory]>(1, Nat.equal, Hash.hash);
        private var nextId : Nat = 1;
        private var nextHistoryId : Nat = 1;

        public func createApproval(approval: Approval) : Result.Result<Approval, Text> {
            let id = nextId;
            nextId += 1;

            let newApproval = {
                id = id;
                date = Time.now();
                phone = approval.phone;
                patientName = approval.patientName;
                title = approval.title;
                description = approval.description;
                fromDoctor = approval.fromDoctor;
                fromEmail = approval.fromEmail;  // 이메일 필드 추가
                fromHospital = approval.fromHospital;
                fromDepartment = approval.fromDepartment;
                fromPhone = approval.fromPhone;
                toDoctor = approval.toDoctor;
                toEmail = approval.toEmail;  // 이메일 필드 추가
                toHospital = approval.toHospital;
                toDepartment = approval.toDepartment;
                toPhone = approval.toPhone;
                cid = approval.cid;
                encryptedAesKeyForSender = approval.encryptedAesKeyForSender;
                encryptedAesKeyForReceiver = approval.encryptedAesKeyForReceiver;
                status = "pending";
                originalApprovalId = approval.originalApprovalId;
                transferredDoctors = [approval.fromDoctor];  // 초기 생성 시 송신자를 이관 목록에 추가
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
                        description = approval.description;
                        fromDoctor = approval.fromDoctor;
                        fromEmail = approval.fromEmail;  // 이메일 필드 추가
                        fromHospital = approval.fromHospital;
                        fromDepartment = approval.fromDepartment;
                        fromPhone = approval.fromPhone;
                        toDoctor = approval.toDoctor;
                        toEmail = approval.toEmail;  // 이메일 필드 추가
                        toHospital = approval.toHospital;
                        toDepartment = approval.toDepartment;
                        toPhone = approval.toPhone;
                        cid = approval.cid;
                        encryptedAesKeyForSender = approval.encryptedAesKeyForSender;
                        encryptedAesKeyForReceiver = approval.encryptedAesKeyForReceiver;
                        status = status;
                        originalApprovalId = approval.originalApprovalId;
                        transferredDoctors = approval.transferredDoctors;
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
                    approval.fromDoctor == doctorName
                } else {
                    approval.toDoctor == doctorName
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

        // 이관 히스토리 추가
        public func addTransferHistory(history: TransferHistory) : Result.Result<(), Text> {
            let histories = switch (transferHistories.get(history.originalApprovalId)) {
                case (null) { [] };
                case (?existing) { existing };
            };
            
            let newHistory = {
                id = nextHistoryId;
                fromDoctor = history.fromDoctor;
                fromEmail = history.fromEmail;
                fromHospital = history.fromHospital;
                fromDepartment = history.fromDepartment;
                fromPhone = history.fromPhone;
                toDoctor = history.toDoctor;
                toEmail = history.toEmail;
                toHospital = history.toHospital;
                toDepartment = history.toDepartment;
                toPhone = history.toPhone;
                date = history.date;
                originalApprovalId = history.originalApprovalId;
            };
            nextHistoryId += 1;
            
            transferHistories.put(history.originalApprovalId, Array.append<TransferHistory>(histories, [newHistory]));
            #ok(())
        };

        // 이관 히스토리 조회
        public func getTransferHistories(approvalId: Nat) : [TransferHistory] {
            switch (transferHistories.get(approvalId)) {
                case (null) { [] };
                case (?histories) { histories };
            }
        };

        // 연관된 승인 목록 조회
        public func getRelatedApprovals(originalId: Nat) : [Approval] {
            let allApprovals = Iter.toArray(approvals.vals());
            Array.filter<Approval>(allApprovals, func (a: Approval) : Bool {
                switch (a.originalApprovalId) {
                    case (null) { a.id == originalId };
                    case (?id) { id == originalId };
                }
            })
        };

        // 이관 가능 여부 확인 함수 추가
        private func canTransfer(approval: Approval, doctorName: Text) : Bool {
            let isCurrentReceiver = approval.toDoctor == doctorName;
            let hasNotTransferred = Option.isNull(
                Array.find<Text>(
                    approval.transferredDoctors,
                    func(x: Text) : Bool { x == doctorName }
                )
            );
            isCurrentReceiver and hasNotTransferred
        };

        // 진료 기록 이관 함수 추가
        public func transferApproval(approvalId: Nat, fromDoctor: Text, toDoctor: Text) : Result.Result<Approval, Text> {
            switch (approvals.get(approvalId)) {
                case (null) { #err("해당 ID의 승인 요청을 찾을 수 없습니다.") };
                case (?approval) {
                    // 이관 가능 여부 확인
                    if (not canTransfer(approval, fromDoctor)) {
                        #err("이관 권한이 없습니다.")
                    } else {
                        let updatedApproval = {
                            id = approval.id;
                            date = Time.now();
                            phone = approval.phone;
                            patientName = approval.patientName;
                            title = approval.title;
                            description = approval.description;
                            fromDoctor = fromDoctor;
                            fromEmail = approval.fromEmail;  // 이메일 필드 추가
                            fromHospital = approval.fromHospital;
                            fromDepartment = approval.fromDepartment;
                            fromPhone = approval.fromPhone;
                            toDoctor = toDoctor;
                            toEmail = approval.toEmail;  // 이메일 필드 추가
                            toHospital = approval.toHospital;
                            toDepartment = approval.toDepartment;
                            toPhone = approval.toPhone;
                            cid = approval.cid;
                            encryptedAesKeyForSender = approval.encryptedAesKeyForSender;
                            encryptedAesKeyForReceiver = approval.encryptedAesKeyForReceiver;
                            status = "pending";
                            originalApprovalId = ?approvalId;
                            transferredDoctors = Array.append<Text>(approval.transferredDoctors, [fromDoctor]);
                        };
                        
                        approvals.put(approvalId, updatedApproval);
                        #ok(updatedApproval)
                    };
                };
            };
        };
    };
}; 